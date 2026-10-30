import type { Request, Response } from 'express';
import {
  getSessionExpiry,
  readAccountState,
  revokeSessionBestEffort,
  setSessionCookies,
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
import { normalizeEmail, validateEmail } from '../../../shared/validation.js';

// Supabase reports these only after the credentials were verified, so a
// distinct message does not reveal which emails are registered.
const FORBIDDEN_CODES = ['user_banned', 'email_not_confirmed'];

async function handleLogin(
  _req: Request,
  res: Response,
  body: Record<string, unknown>,
) {
  const { email, password } = body;

  if (typeof email !== 'string' || typeof password !== 'string') {
    return res.status(400).json({ message: 'Email and password are required' });
  }
  if (!validateEmail(email)) {
    return res.status(400).json({ message: 'Invalid email' });
  }

  const supabase = createAnonClient();
  const { data, error } = await supabase.auth.signInWithPassword({
    email: normalizeEmail(email),
    password,
  });

  if (error?.code && FORBIDDEN_CODES.includes(error.code)) {
    return res.status(403).json({ message: 'Account not allowed to log in' });
  }
  if (isRateLimitError(error)) {
    return sendTooManyRequests(res);
  }
  if (error?.code === 'invalid_credentials') {
    return res.status(400).json({ message: 'Invalid email or password' });
  }
  if (error) {
    throw error;
  }

  // Supabase Auth ignores profiles.status, so a blocked user still gets a valid
  // token. Check the status with the caller's own JWT (RLS applies) and never
  // return the tokens for a blocked user.
  // The role is only a hint for the UI: authorization is enforced by RLS.
  const userClient = createUserClient(data.session.access_token);
  const account = await readAccountState(userClient, data.user.id);
  if (!account.isActive) {
    await revokeSessionBestEffort(supabase, data.session.access_token);
    return res.status(403).json({ message: 'Account blocked' });
  }

  // The tokens never reach the page's JavaScript: both travel in HttpOnly
  // cookies. Only the expiry is returned, so the page knows when to renew.
  setSessionCookies(res, data.session);

  return res.status(200).json({
    message: 'Login successful',
    user: { id: data.user.id, email: data.user.email, role: account.role },
    expires_at: getSessionExpiry(data.session),
  });
}

export default withMethod('POST', withObjectBody(handleLogin));
