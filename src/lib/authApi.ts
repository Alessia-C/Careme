import { isRole, type Role } from '../../shared/validation';

export interface SignupInput {
  firstName: string;
  lastName: string;
  email: string;
  password: string;
}

// The API answers duplicate emails with the same generic 400 as other
// failures (anti-enumeration), so the UI cannot tell them apart: only the
// rate limit needs a different message.
export type SignupResult =
  { ok: true } | { ok: false; reason: 'rate-limited' | 'failed' };

export async function signup(input: SignupInput): Promise<SignupResult> {
  try {
    const response = await fetch('/api/auth/signup', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(input),
    });

    if (response.ok) {
      return { ok: true };
    }
    if (response.status === 429) {
      return { ok: false, reason: 'rate-limited' };
    }
    return { ok: false, reason: 'failed' };
  } catch {
    // fetch rejects only on network errors (offline, DNS, CORS).
    return { ok: false, reason: 'failed' };
  }
}

// Shape shared by the login and /me responses. The body is parsed as unknown
// and checked field by field: the server is trusted, but not blindly.
function parseSession(body: unknown) {
  const user = (body as { user?: Record<string, unknown> } | null)?.user;
  if (
    typeof user?.id !== 'string' ||
    typeof user.email !== 'string' ||
    !isRole(user.role)
  ) {
    return null;
  }
  return { user: { id: user.id, email: user.email }, role: user.role };
}

export interface LoginInput {
  email: string;
  password: string;
}

// 400 (wrong credentials) and 403 (blocked or unconfirmed account) share one
// reason on purpose: the UI must not reveal which emails exist or their state.
export type LoginResult =
  | { ok: true; user: { id: string; email: string }; role: Role }
  | { ok: false; reason: 'invalid-credentials' | 'rate-limited' | 'failed' };

// The session itself is an HttpOnly cookie set by the API: it never reaches
// this code. The browser stores it and sends it back on its own.
export async function login(input: LoginInput): Promise<LoginResult> {
  try {
    const response = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(input),
    });

    if (response.status === 400 || response.status === 403) {
      return { ok: false, reason: 'invalid-credentials' };
    }
    if (response.status === 429) {
      return { ok: false, reason: 'rate-limited' };
    }
    if (!response.ok) {
      return { ok: false, reason: 'failed' };
    }

    const session = parseSession(await response.json());
    return session ? { ok: true, ...session } : { ok: false, reason: 'failed' };
  } catch {
    // fetch rejects on network errors, json() on a malformed body.
    return { ok: false, reason: 'failed' };
  }
}

export type LogoutResult = { ok: true } | { ok: false; reason: 'failed' };

// 401 means the session was already over: for the user that is a successful
// logout. The API clears the session cookie itself, the client only has to
// drop its own state afterwards, whatever the outcome.
export async function logout(): Promise<LogoutResult> {
  try {
    // The API ignores the body but requires JSON: it is a CSRF defence.
    const response = await fetch('/api/auth/logout', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: '{}',
    });
    return response.ok || response.status === 401
      ? { ok: true }
      : { ok: false, reason: 'failed' };
  } catch {
    // fetch rejects only on network errors (offline, DNS, CORS).
    return { ok: false, reason: 'failed' };
  }
}

// 401 and 403 (expired, revoked or blocked) all mean "no session": the user
// has to sign in. Anything else (network error, 5xx, malformed body) says
// nothing about the session, so it is reported apart and the UI can warn
// instead of silently logging the user out.
export type SessionResult =
  | { ok: true; user: { id: string; email: string }; role: Role }
  | { ok: false; reason: 'no-session' | 'failed' };

// Reads the HttpOnly cookie through the API: the token never reaches this code.
export async function fetchSession(): Promise<SessionResult> {
  try {
    const response = await fetch('/api/auth/me');

    if (response.status === 401 || response.status === 403) {
      return { ok: false, reason: 'no-session' };
    }
    if (!response.ok) {
      return { ok: false, reason: 'failed' };
    }

    const session = parseSession(await response.json());
    return session ? { ok: true, ...session } : { ok: false, reason: 'failed' };
  } catch {
    // fetch rejects on network errors, json() on a malformed body.
    return { ok: false, reason: 'failed' };
  }
}
