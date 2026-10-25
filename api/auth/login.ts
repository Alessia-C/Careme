import type { VercelRequest, VercelResponse } from '@vercel/node';
import { buildSessionCookie } from '../_lib/auth.js';
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
import {
  isRole,
  normalizeEmail,
  validateEmail,
} from '../../shared/validation.js';

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

  // The role is only a hint for the UI: authorization is enforced by RLS.
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

  // The tokens never reach the page's JavaScript: the access token travels in
  // an HttpOnly cookie. The refresh token is not stored for now.
  res.setHeader(
    'Set-Cookie',
    buildSessionCookie(data.session.access_token, data.session.expires_in),
  );

  return res.status(200).json({
    message: 'Login successful',
    user: { id: data.user.id, email: data.user.email, role },
  });
}

export default withSentry(withMethod('POST', withObjectBody(handleLogin)));
