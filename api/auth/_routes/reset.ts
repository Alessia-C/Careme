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
import { validatePassword } from '../../../shared/validation.js';

const INVALID_LINK_MESSAGE = 'Invalid or expired link';
const PASSWORD_POLICY_MESSAGE =
  'Invalid password: use 8-20 characters with an uppercase letter, a lowercase letter, a number and a special character';

// An unknown, expired or already used token comes back as a 4xx from Supabase
// (the exact status and code vary), so any 4xx counts as a bad link. Rate
// limits are handled before this check.
function isClientError(error: { status?: number }): boolean {
  return (
    typeof error.status === 'number' &&
    error.status >= 400 &&
    error.status < 500
  );
}

async function handleReset(
  _req: Request,
  res: Response,
  body: Record<string, unknown>,
) {
  const { token, password } = body;

  // The token is the only thing that authorizes the change: an email in the
  // body is never read. It is checked first, whatever the password is.
  if (typeof token !== 'string' || token.trim() === '') {
    return res.status(400).json({ message: INVALID_LINK_MESSAGE });
  }
  // Before verifyOtp, which consumes the token: a weak password must not burn
  // the link the user still needs.
  if (typeof password !== 'string' || !validatePassword(password)) {
    return res.status(400).json({ message: PASSWORD_POLICY_MESSAGE });
  }

  const supabase = createAnonClient();
  const { data, error: verifyError } = await supabase.auth.verifyOtp({
    token_hash: token,
    type: 'recovery',
  });
  if (isRateLimitError(verifyError)) {
    return sendTooManyRequests(res);
  }
  if (verifyError && isClientError(verifyError)) {
    return res.status(400).json({ message: INVALID_LINK_MESSAGE });
  }
  if (verifyError) {
    throw verifyError;
  }
  if (!data.session) {
    throw new Error('Unexpected recovery without session');
  }

  // Supabase Auth ignores profiles.status, so a blocked user can verify the
  // link. Check it with the caller's own JWT (RLS applies): the password of a
  // blocked user is not changed and the session is not left open.
  const { access_token: accessToken } = data.session;
  if (!(await isAccountActive(createUserClient(accessToken)))) {
    await revokeSessionBestEffort(supabase, accessToken);
    return res.status(403).json({ message: 'Account blocked' });
  }

  // verifyOtp left the recovery session in this client, which updateUser uses.
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
  await revokeSessionBestEffort(supabase, accessToken, {
    scope: 'global',
    context: 'revoke-sessions-after-password-reset',
  });

  return res.status(200).json({ message: 'Password updated' });
}

export default withMethod('POST', withObjectBody(handleReset));
