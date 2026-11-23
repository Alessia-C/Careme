import type { Request, Response } from 'express';
import { isAccountActive, revokeSessionBestEffort } from '../../_lib/auth.js';
import {
  sendTooManyRequests,
  withMethod,
  withObjectBody,
} from '../../_lib/http.js';
import {
  createAnonClient,
  createUserClient,
  isRateLimitError,
} from '../../_lib/supabase.js';
import { isObject, validatePassword } from '../../../shared/validation.js';

const INVALID_LINK_MESSAGE = 'Invalid or expired link';
const PASSWORD_POLICY_MESSAGE =
  'Invalid password: use 8-20 characters with an uppercase letter, a lowercase letter, a number and a special character';

// How Supabase records that the session came from an emailed link. The
// recovery link is verified by Supabase itself, which then sends the browser to
// the app with a session: a password login records 'password' instead.
const EMAIL_LINK_AMR_METHODS = ['otp', 'recovery'];

// Long enough to type a new password, short enough that an old session lying
// around is not a way to change it.
const RECOVERY_SESSION_MAX_AGE_SECONDS = 15 * 60;

// An unknown, expired or revoked session comes back as a 4xx from Supabase (the
// exact status and code vary), so any 4xx counts as a bad link. Rate limits are
// handled before this check.
function isClientError(error: { status?: number }): boolean {
  return (
    typeof error.status === 'number' &&
    error.status >= 400 &&
    error.status < 500
  );
}

function readTokenPayload(token: string): Record<string, unknown> | undefined {
  const payload = token.split('.')[1];
  if (!payload) {
    return undefined;
  }
  try {
    const parsed: unknown = JSON.parse(
      Buffer.from(payload, 'base64url').toString(),
    );
    return isObject(parsed) ? parsed : undefined;
  } catch {
    return undefined;
  }
}

// This endpoint changes a password without asking for the current one, so it
// must only accept the session that an emailed recovery link creates. Any other
// valid session (a normal login, a stolen one) would otherwise be enough to
// take over the account.
// The claims are read without verifying the signature: this is only a cheap
// filter that runs before anything is sent to Supabase, and it also keeps an
// ordinary session from being refreshed (and so rotated) by setSession. The
// token itself is verified by Supabase right after, so a forged claim does not
// get past it.
function isRecentRecoverySession(accessToken: string): boolean {
  const amr = readTokenPayload(accessToken)?.amr;
  if (!Array.isArray(amr)) {
    return false;
  }
  const now = Math.floor(Date.now() / 1000);
  return amr.some(
    (entry) =>
      isObject(entry) &&
      typeof entry.method === 'string' &&
      EMAIL_LINK_AMR_METHODS.includes(entry.method) &&
      typeof entry.timestamp === 'number' &&
      now - entry.timestamp <= RECOVERY_SESSION_MAX_AGE_SECONDS,
  );
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim() !== '';
}

async function handleReset(
  _req: Request,
  res: Response,
  body: Record<string, unknown>,
) {
  const { accessToken, refreshToken, password } = body;

  // The recovery session is the only thing that authorizes the change: an
  // email in the body is never read. It is checked first, whatever the
  // password is.
  if (
    !isNonEmptyString(accessToken) ||
    !isNonEmptyString(refreshToken) ||
    !isRecentRecoverySession(accessToken)
  ) {
    return res.status(400).json({ message: INVALID_LINK_MESSAGE });
  }
  if (typeof password !== 'string' || !validatePassword(password)) {
    return res.status(400).json({ message: PASSWORD_POLICY_MESSAGE });
  }

  // Supabase verifies the token here. setSession keeps the session in this
  // client only, which updateUser then uses.
  const supabase = createAnonClient();
  const { data, error: sessionError } = await supabase.auth.setSession({
    access_token: accessToken,
    refresh_token: refreshToken,
  });
  if (isRateLimitError(sessionError)) {
    return sendTooManyRequests(res);
  }
  if (sessionError && isClientError(sessionError)) {
    return res.status(400).json({ message: INVALID_LINK_MESSAGE });
  }
  if (sessionError) {
    throw sessionError;
  }
  if (!data.session) {
    throw new Error('Unexpected recovery without session');
  }

  // Supabase Auth ignores profiles.status, so a blocked user gets a recovery
  // session too. Check it with the caller's own JWT (RLS applies): the password
  // of a blocked user is not changed and the session is not left open.
  const { access_token: sessionToken } = data.session;
  if (!(await isAccountActive(createUserClient(sessionToken)))) {
    await revokeSessionBestEffort(supabase, sessionToken);
    return res.status(403).json({ message: 'Account blocked' });
  }

  const { error: updateError } = await supabase.auth.updateUser({ password });
  if (isRateLimitError(updateError)) {
    return sendTooManyRequests(res);
  }
  if (updateError?.code === 'weak_password') {
    return res.status(400).json({ message: PASSWORD_POLICY_MESSAGE });
  }
  if (updateError?.code === 'same_password') {
    return res.status(400).json({
      message: 'The new password must be different from the current one',
    });
  }
  if (updateError) {
    throw updateError;
  }

  // The password was changed because the account may be in someone else's
  // hands: every session is revoked, this one included. No cookie is set, the
  // user logs in again with the new password.
  await revokeSessionBestEffort(supabase, sessionToken, {
    scope: 'global',
    context: 'revoke-sessions-after-password-reset',
  });

  return res.status(200).json({ message: 'Password updated' });
}

export default withMethod('POST', withObjectBody(handleReset));
