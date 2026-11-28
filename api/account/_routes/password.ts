import type { Request, Response } from 'express';
import type { Session } from '@supabase/supabase-js';
import {
  getSessionExpiry,
  revokeSessionBestEffort,
  setSessionCookies,
  withAuth,
  type AuthContext,
} from '../../_lib/auth.js';
import {
  sendTooManyRequests,
  withMethod,
  withObjectBody,
} from '../../_lib/http.js';
import { createAnonClient, isRateLimitError } from '../../_lib/supabase.js';
import {
  PASSWORD_POLICY_MESSAGE,
  SAME_PASSWORD_MESSAGE,
} from '../../../shared/validation.js';
import { parsePasswordInput, type PasswordInput } from '../_validation.js';

const WRONG_PASSWORD_MESSAGE = 'Current password is incorrect';

// Supabase reports these only after the credentials were verified.
const FORBIDDEN_CODES = ['user_banned', 'email_not_confirmed'];

type AnonClient = ReturnType<typeof createAnonClient>;

// The errors of updateUser that the user can fix. Anything else, a request to
// reauthenticate or a missing current password included, is a fault of this code
// or of the Supabase settings (the session is brand new and the password is
// always sent), so it must reach Sentry as a 500.
const UPDATE_ERROR_MESSAGES = new Map<string, string>([
  ['weak_password', PASSWORD_POLICY_MESSAGE],
  ['same_password', SAME_PASSWORD_MESSAGE],
  // Only possible if the password changed after it was verified here.
  ['current_password_invalid', WRONG_PASSWORD_MESSAGE],
]);

// Everything after the current password was verified. Kept apart so that
// changePassword can close the new session if anything here fails.
async function updatePassword(
  res: Response,
  supabase: AnonClient,
  session: Session,
  { current_password, new_password }: PasswordInput,
) {
  // The current password is sent to Supabase too: with "require current
  // password" enabled in the project, it refuses the change without it.
  const { error } = await supabase.auth.updateUser({
    password: new_password,
    current_password,
  });
  const message = UPDATE_ERROR_MESSAGES.get(error?.code ?? '');
  if (message || isRateLimitError(error)) {
    await revokeSessionBestEffort(supabase, session.access_token, {
      context: 'revoke-session-after-refused-password-change',
    });
    return message
      ? res.status(400).json({ message })
      : sendTooManyRequests(res);
  }
  if (error) {
    throw error;
  }

  // The caller moves to the session just created and every other one is closed,
  // the old cookie of this browser included. Supabase Auth is expected to close
  // them itself on a password change, but this API does not rely on that and
  // asks explicitly.
  await revokeSessionBestEffort(supabase, session.access_token, {
    scope: 'others',
    context: 'revoke-other-sessions-after-password-change',
  });

  // Set only now, so that no earlier failure leaves cookies of a revoked
  // session in the browser.
  setSessionCookies(res, session);

  return res.status(200).json({
    message: 'Password updated',
    expires_at: getSessionExpiry(session),
  });
}

async function changePassword(
  res: Response,
  auth: AuthContext,
  input: PasswordInput,
) {
  // Signing in verifies the current password and gives this client the session
  // that updateUser needs: the caller's own refresh cookie is only sent to
  // /api/auth. The email comes from the verified session, never from the body.
  const supabase = createAnonClient();
  const { data, error } = await supabase.auth.signInWithPassword({
    email: auth.email,
    password: input.current_password,
  });
  if (isRateLimitError(error)) {
    return sendTooManyRequests(res);
  }
  // Never 401: the page would take it for an expired session and log out.
  if (error?.code === 'invalid_credentials') {
    return res.status(400).json({ message: WRONG_PASSWORD_MESSAGE });
  }
  if (error?.code && FORBIDDEN_CODES.includes(error.code)) {
    return res.status(403).json({ message: 'Account not allowed to log in' });
  }
  if (error) {
    throw error;
  }

  // The account status is not read again, unlike on login: withAuth has just
  // checked it for this same user, which is verified here.
  try {
    if (data.user.id !== auth.id) {
      throw new Error('Unexpected user for the verified password');
    }
    return await updatePassword(res, supabase, data.session, input);
  } catch (error) {
    await revokeSessionBestEffort(supabase, data.session.access_token, {
      context: 'revoke-session-after-password-change-error',
    });
    throw error;
  }
}

function handlePassword(req: Request, res: Response, auth: AuthContext) {
  // The response sets the session cookies: no cache may keep it.
  res.setHeader('Cache-Control', 'no-store');
  // Inside withAuth, so an anonymous caller gets 401 before the checks on the
  // content type and the fields. A body that the parser of the app refuses
  // (malformed, too large) is answered earlier. The caller's token is not needed:
  // the change runs on the new session.
  return withObjectBody((_req, _res, body) => {
    const parsed = parsePasswordInput(body);
    if (!parsed.ok) {
      return res.status(400).json({ message: parsed.message });
    }
    return changePassword(res, auth, parsed.value);
  })(req, res);
}

export default withMethod('POST', withAuth(handlePassword));
