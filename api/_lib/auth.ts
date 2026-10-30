import type { Request, Response } from 'express';
import {
  isAuthApiError,
  isAuthSessionMissingError,
} from '@supabase/supabase-js';
import * as Sentry from '@sentry/node';
import { isRole, type Role } from '../../shared/validation.js';
import { getCookie } from './cookies.js';
import { sendTooManyRequests, type Handler } from './http.js';
import {
  createAnonClient,
  createUserClient,
  isRateLimitError,
} from './supabase.js';

export function getBearerToken(req: Request): string | undefined {
  const authHeader = req.headers.authorization;
  const prefix = 'Bearer ';
  const token = authHeader ? authHeader.slice(prefix.length) : undefined;
  const isTokenEmpty = token === '' || token === undefined;
  const isAuthHeaderMissing = !authHeader || !authHeader.startsWith(prefix);

  if (isTokenEmpty || isAuthHeaderMissing) {
    return undefined;
  }

  return token;
}

// The browser keeps the session in an HttpOnly cookie, so scripts (and any XSS)
// cannot read the token. SameSite=Strict is the CSRF protection: the cookie is
// never sent on cross-site requests.
//
// `vercel dev` serves plain http, where Safari drops Secure cookies and the
// __Host- prefix (which requires Secure) cannot be used.
const isLocalDev = () => process.env.VERCEL_ENV === 'development';

// The __Host- prefix makes the browser refuse a cookie that a sibling
// subdomain or a plain-http response tries to set with a wider Domain (cookie
// tossing), so another site cannot plant its own session in the victim's
// browser. It requires Secure, Path=/ and no Domain.
export const getSessionCookieName = () =>
  isLocalDev() ? 'sb-access-token' : '__Host-sb-access-token';

// Without maxAgeSeconds the cookie is a browser-session cookie: it disappears
// when the browser is closed.
function buildCookie(
  name: string,
  value: string,
  path: string,
  maxAgeSeconds?: number,
) {
  const secure = isLocalDev() ? '' : '; Secure';
  const maxAge =
    maxAgeSeconds === undefined ? '' : `; Max-Age=${maxAgeSeconds}`;
  return `${name}=${value}; HttpOnly; SameSite=Strict; Path=${path}${maxAge}${secure}`;
}

export function buildSessionCookie(token: string, maxAgeSeconds: number) {
  return buildCookie(getSessionCookieName(), token, '/', maxAgeSeconds);
}

// A cookie is deleted by setting it again with Max-Age=0. The browser matches
// it by name, Path and Domain, so every attribute must equal the original one.
export function buildClearedSessionCookie() {
  return buildSessionCookie('', 0);
}

// The refresh token outlives the access token, so it is the more valuable one:
// it is sent only to /api/auth/* (Path), where the endpoints that need it live.
// The __Host- prefix is not usable here because it requires Path=/, so
// __Secure- (Secure only) is the strongest prefix available.
export const getRefreshCookieName = () =>
  isLocalDev() ? 'sb-refresh-token' : '__Secure-sb-refresh-token';

const REFRESH_COOKIE_PATH = '/api/auth';

// No Max-Age on purpose: Supabase refresh tokens do not expire by themselves,
// so a cookie that outlived the browser would leave a usable session on a
// shared device. Browsers may still restore session cookies on restart, which
// is why /api/auth/refresh also requires the access cookie (it expires with
// the access token, so it enforces the inactivity limit on the server too).
export function buildRefreshCookie(token: string) {
  return buildCookie(getRefreshCookieName(), token, REFRESH_COOKIE_PATH);
}

export function buildClearedRefreshCookie() {
  return buildCookie(getRefreshCookieName(), '', REFRESH_COOKIE_PATH, 0);
}

export function getRefreshToken(req: Request): string | undefined {
  return getCookie(req, getRefreshCookieName());
}

// Both cookies travel in one Set-Cookie header: a second setHeader call with
// the same name would replace the first one.
export function setSessionCookies(
  res: Response,
  session: { access_token: string; refresh_token: string; expires_in: number },
) {
  res.setHeader('Set-Cookie', [
    buildSessionCookie(session.access_token, session.expires_in),
    buildRefreshCookie(session.refresh_token),
  ]);
}

export function clearSessionCookies(res: Response) {
  res.setHeader('Set-Cookie', [
    buildClearedSessionCookie(),
    buildClearedRefreshCookie(),
  ]);
}

// Unix time (seconds) when the access token stops being valid. The page uses
// it to renew the session in time; it is not a secret.
export function getSessionExpiry(session: {
  expires_in: number;
  expires_at?: number;
}): number {
  return (
    session.expires_at ?? Math.floor(Date.now() / 1000) + session.expires_in
  );
}

// Reads the `exp` claim of a token that withAuth has already verified, so the
// payload can be trusted: decoding here is not a replacement for verifying.
export function getTokenExpiry(token: string): number {
  const payload = token.split('.')[1] ?? '';
  // The cast only names the field to check: `exp` is validated right below.
  const { exp } = JSON.parse(Buffer.from(payload, 'base64url').toString()) as {
    exp?: unknown;
  };
  if (typeof exp !== 'number') {
    throw new Error('Unexpected token without exp');
  }
  return exp;
}

// Supabase Auth ignores profiles.status, so a blocked user still holds valid
// tokens. The check runs as the caller (RLS applies) and anything but an
// explicit `true` counts as blocked.
export async function isAccountActive(
  userClient: ReturnType<typeof createUserClient>,
): Promise<boolean> {
  // The cast is the same justified exception as the 'profiles' ones: the
  // generated DB types are still empty.
  const { data, error } = await userClient.rpc('is_active' as never);
  if (error) {
    throw error;
  }
  return data === true;
}

export type AccountState = { isActive: false } | { isActive: true; role: Role };

// Reads the status and the role of the caller with their own JWT (RLS
// applies). The two are independent, so they run in parallel: one round trip
// to Supabase less on every login and protected request. For a blocked user
// RLS hides the profile, so the role result is only looked at after the
// status: a blocked user gets { isActive: false }, never an error.
export async function readAccountState(
  userClient: ReturnType<typeof createUserClient>,
  userId: string,
): Promise<AccountState> {
  // The cast is the same justified exception as the other 'profiles' ones: the
  // generated DB types are still empty.
  const [isActive, { data: profile, error: roleError }] = await Promise.all([
    isAccountActive(userClient),
    userClient
      .from('profiles' as never)
      .select('role')
      .eq('id', userId)
      .single(),
  ]);
  if (!isActive) {
    return { isActive: false };
  }
  if (roleError) {
    throw roleError;
  }
  const role = (profile as { role?: unknown } | null)?.role;
  if (!isRole(role)) {
    throw new Error('Unexpected profile role');
  }
  return { isActive: true, role };
}

// Browsers send the cookie; API clients (curl, tests) can still use the
// Authorization header, which wins when both are present.
export function getAccessToken(req: Request): string | undefined {
  return getBearerToken(req) ?? getCookie(req, getSessionCookieName());
}

export type AuthContext = { id: string; email: string; role: Role };

type AuthHandler = (
  req: Request,
  res: Response,
  auth: AuthContext,
) => unknown | Promise<unknown>;

// Same statuses supabase-js itself ignores on sign out: the JWT is invalid or
// expired (401), forbidden (403) or the user no longer exists (404). A revoked
// session is reported as an AuthSessionMissingError instead.
const SESSION_INVALID_STATUSES = [401, 403, 404];

export function isInvalidSessionError(error: unknown): boolean {
  return (
    isAuthSessionMissingError(error) ||
    (isAuthApiError(error) && SESSION_INVALID_STATUSES.includes(error.status))
  );
}

// Supabase creates the session before the profile can be checked, so a blocked
// user still gets one. It is revoked so no valid token is left on Supabase.
// Best effort: the user is refused either way and RLS blocks the token, so a
// failure is reported to Sentry (supabase-js returns errors instead of
// throwing, nobody would see it otherwise) and not turned into a 500.
export async function revokeSessionBestEffort(
  supabase: ReturnType<typeof createAnonClient>,
  accessToken: string,
) {
  const { error } = await supabase.auth.admin.signOut(accessToken, 'local');
  if (error) {
    Sentry.captureException(error, {
      tags: { context: 'revoke-blocked-user-session' },
    });
    await Sentry.flush(2000);
  }
}

// Supabase answers 400 for an unknown or already used refresh token, but also
// for malformed requests, so 400 is matched by code: only a dead token may log
// the user out. Anything else (5xx, network) is a real fault and the page
// retries.
const REFRESH_TOKEN_INVALID_CODES = [
  'refresh_token_not_found',
  'refresh_token_already_used',
  'session_not_found',
];

export function isRefreshTokenInvalid(error: unknown): boolean {
  return (
    isAuthApiError(error) &&
    (SESSION_INVALID_STATUSES.includes(error.status) ||
      (error.code !== undefined &&
        REFRESH_TOKEN_INVALID_CODES.includes(error.code)))
  );
}

// Single point of enforcement for authentication: rejects the request unless
// the JWT is valid, then passes the caller's id, email and role to the handler. The
// role is read from the database, never from the request, because the client
// controls everything it sends.
export function withAuth(handler: AuthHandler): Handler {
  return async (req, res) => {
    const token = getAccessToken(req);
    if (!token) {
      return res
        .status(401)
        .json({ message: 'Missing or invalid authorization header' });
    }

    // getUser asks Supabase to validate the token, so a revoked session is
    // rejected too. A local signature check would accept it until expiry.
    const { data, error } = await createAnonClient().auth.getUser(token);
    if (isRateLimitError(error)) {
      return sendTooManyRequests(res);
    }
    // An expired or revoked session is an expected case, not a server fault:
    // answer 401 (no Sentry noise) so the client redirects to the login.
    if (isInvalidSessionError(error)) {
      return res.status(401).json({ message: 'Session expired or invalid' });
    }
    if (error) {
      throw error;
    }

    // Password accounts always have an email: anything else is a broken user.
    const { email } = data.user;
    if (typeof email !== 'string') {
      throw new Error('Unexpected user without email');
    }

    // Supabase Auth ignores profiles.status, so a blocked user still has a
    // valid token. Check it with the caller's own JWT (RLS applies).
    const account = await readAccountState(
      createUserClient(token),
      data.user.id,
    );
    if (!account.isActive) {
      return res.status(403).json({ message: 'Account blocked' });
    }

    return handler(req, res, { id: data.user.id, email, role: account.role });
  };
}
