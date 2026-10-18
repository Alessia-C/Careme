import type { VercelRequest, VercelResponse } from '@vercel/node';
import { withSentry } from '../_lib/sentry.js';
import {
  sendTooManyRequests,
  withMethod,
  withObjectBody,
} from '../_lib/http.js';
import {
  createAnonClient,
  createUserClient,
  isRateLimitError,
} from '../_lib/supabase.js';
import { normalizeEmail, validateEmail } from '../../shared/validation.js';

// Supabase reports these only after the credentials were verified, so a
// distinct message does not reveal which emails are registered.
const FORBIDDEN_CODES = ['user_banned', 'email_not_confirmed'];

async function handleLogin(
  _req: VercelRequest,
  res: VercelResponse,
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
  const userClient = createUserClient(data.session.access_token);
  // The cast is the same justified exception as the 'profiles' ones: the
  // generated DB types are still empty.
  const { data: isActive, error: statusError } = await userClient.rpc(
    'is_active' as never,
  );
  if (statusError) {
    throw statusError;
  }
  if (isActive !== true) {
    return res.status(403).json({ message: 'Account blocked' });
  }

  return res.status(200).json({
    message: 'Login successful',
    session: {
      access_token: data.session.access_token,
      refresh_token: data.session.refresh_token,
      expires_at: data.session.expires_at,
    },
    user: { id: data.user.id, email: data.user.email },
  });
}

export default withSentry(withMethod('POST', withObjectBody(handleLogin)));
