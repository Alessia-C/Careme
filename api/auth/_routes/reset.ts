import type { Request, Response } from 'express';
import {
  isAccountActive,
  readTokenClaims,
  revokeSessionBestEffort,
} from '../../_lib/auth.js';
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
import {
  PASSWORD_POLICY_MESSAGE,
  SAME_PASSWORD_MESSAGE,
  isObject,
  validatePassword,
} from '../../../shared/validation.js';

const INVALID_LINK_MESSAGE = 'Invalid or expired link';

// How Supabase records that the session came from an emailed link. The
// recovery link is verified by Supabase itself, which then sends the browser to
// the app with a session: a password login records 'password' instead.
const EMAIL_LINK_AMR_METHODS = ['otp', 'recovery'];

// Long enough to type a new password, short enough that an old session lying
// around is not a way to change it.
const RECOVERY_SESSION_MAX_AGE_SECONDS = 15 * 60;

// Tolerance for a clock that is slightly ahead of this server's.
const CLOCK_SKEW_SECONDS = 60;

type AnonClient = ReturnType<typeof createAnonClient>;

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

// This endpoint changes a password without asking for the current one, so it
// must only accept the session that an emailed recovery link creates: any other
// valid session (a normal login, a stolen one) would otherwise be enough to
// take over the account.
// The claims are read without verifying the signature, so this is only a
// pre-filter. A token without a valid `exp` is refused here because setSession
// would then ignore it and build the session from the refresh token alone, one
// whose claims were never checked. handleReset then requires Supabase to hand
// back this same token, which proves the claims are the verified ones.
function isRecentRecoverySession(accessToken: string): boolean {
  const claims = readTokenClaims(accessToken);
  const now = Math.floor(Date.now() / 1000);
  if (
    !claims ||
    typeof claims.exp !== 'number' ||
    claims.exp <= now ||
    !Array.isArray(claims.amr)
  ) {
    return false;
  }
  return claims.amr.some((entry) => {
    if (
      !isObject(entry) ||
      typeof entry.method !== 'string' ||
      typeof entry.timestamp !== 'number'
    ) {
      return false;
    }
    const ageSeconds = now - entry.timestamp;
    return (
      EMAIL_LINK_AMR_METHODS.includes(entry.method) &&
      ageSeconds >= -CLOCK_SKEW_SECONDS &&
      ageSeconds <= RECOVERY_SESSION_MAX_AGE_SECONDS
    );
  });
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim() !== '';
}

// Everything after Supabase has verified the session. Kept apart so that
// handleReset can close the session if anything here fails unexpectedly.
async function changePassword(
  res: Response,
  supabase: AnonClient,
  sessionToken: string,
  password: string,
) {
  // Supabase Auth ignores profiles.status, so a blocked user gets a recovery
  // session too. Check it with the caller's own JWT (RLS applies): the password
  // of a blocked user is not changed and the session is not left open.
  if (!(await isAccountActive(createUserClient(sessionToken)))) {
    await revokeSessionBestEffort(supabase, sessionToken);
    return res.status(403).json({ message: 'Account blocked' });
  }

  // The errors below that the user can fix (a rate limit, a password that is
  // refused) keep the session open on purpose: a retry with the same link
  // needs no new email, and the email limit of Supabase is very low.
  const { error: updateError } = await supabase.auth.updateUser({ password });
  if (isRateLimitError(updateError)) {
    return sendTooManyRequests(res);
  }
  if (updateError?.code === 'weak_password') {
    return res.status(400).json({ message: PASSWORD_POLICY_MESSAGE });
  }
  if (updateError?.code === 'same_password') {
    return res.status(400).json({ message: SAME_PASSWORD_MESSAGE });
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

  // A different token means Supabase did not verify the one that was sent but
  // built a new session from the refresh token, so the claims checked above say
  // nothing about it. Never proceed with it.
  const { access_token: sessionToken } = data.session;
  if (sessionToken !== accessToken) {
    await revokeSessionBestEffort(supabase, sessionToken);
    return res.status(400).json({ message: INVALID_LINK_MESSAGE });
  }

  // An unexpected failure must not leave this session open: it is a complete
  // session of the app, and its tokens are in the browser history.
  try {
    return await changePassword(res, supabase, sessionToken, password);
  } catch (error) {
    await revokeSessionBestEffort(supabase, sessionToken, {
      context: 'revoke-recovery-session-after-error',
    });
    throw error;
  }
}

export default withMethod('POST', withObjectBody(handleReset));
