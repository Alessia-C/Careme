import type { VercelRequest, VercelResponse } from '@vercel/node';
import {
  isAuthApiError,
  isAuthSessionMissingError,
} from '@supabase/supabase-js';
import { isRole, type Role } from '../../shared/validation.js';
import { sendTooManyRequests, type Handler } from './http.js';
import {
  createAnonClient,
  createUserClient,
  isRateLimitError,
} from './supabase.js';

export function getBearerToken(req: VercelRequest): string | undefined {
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
export const ACCESS_TOKEN_COOKIE = 'sb-access-token';

export function buildSessionCookie(token: string, maxAgeSeconds: number) {
  // `vercel dev` serves plain http, where Safari drops Secure cookies.
  const secure = process.env.VERCEL_ENV === 'development' ? '' : '; Secure';
  return `${ACCESS_TOKEN_COOKIE}=${token}; HttpOnly; SameSite=Strict; Path=/; Max-Age=${maxAgeSeconds}${secure}`;
}

// Browsers send the cookie; API clients (curl, tests) can still use the
// Authorization header, which wins when both are present.
export function getAccessToken(req: VercelRequest): string | undefined {
  return getBearerToken(req) ?? (req.cookies[ACCESS_TOKEN_COOKIE] || undefined);
}

export type AuthContext = { id: string; role: Role };

type AuthHandler = (
  req: VercelRequest,
  res: VercelResponse,
  auth: AuthContext,
) => unknown | Promise<unknown>;

// Same statuses supabase-js itself ignores on sign out: the JWT is invalid or
// expired (401), forbidden (403) or the user no longer exists (404). A revoked
// session is reported as an AuthSessionMissingError instead.
const SESSION_INVALID_STATUSES = [401, 403, 404];

function isInvalidSessionError(error: unknown): boolean {
  return (
    isAuthSessionMissingError(error) ||
    (isAuthApiError(error) && SESSION_INVALID_STATUSES.includes(error.status))
  );
}

// Single point of enforcement for authentication: rejects the request unless
// the JWT is valid, then passes the caller's id and role to the handler. The
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

    // Supabase Auth ignores profiles.status, so a blocked user still has a
    // valid token. Check it with the caller's own JWT (RLS applies).
    const userClient = createUserClient(token);
    // The casts are the same justified exception as in login.ts: the generated
    // DB types are still empty.
    const { data: isActive, error: statusError } = await userClient.rpc(
      'is_active' as never,
    );
    if (statusError) {
      throw statusError;
    }
    if (isActive !== true) {
      return res.status(403).json({ message: 'Account blocked' });
    }

    const { data: profile, error: roleError } = await userClient
      .from('profiles' as never)
      .select('role')
      .eq('id', data.user.id)
      .single();
    if (roleError) {
      throw roleError;
    }
    const role = (profile as { role?: unknown } | null)?.role;
    if (!isRole(role)) {
      throw new Error('Unexpected profile role');
    }

    return handler(req, res, { id: data.user.id, role });
  };
}
