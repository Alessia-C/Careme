import type { VercelRequest, VercelResponse } from '@vercel/node';
import { withSentry } from '../_lib/sentry.js';
import {
  sendTooManyRequests,
  withMethod,
  withObjectBody,
} from '../_lib/http.js';
import { createAnonClient, isRateLimitError } from '../_lib/supabase.js';
import {
  normalizeEmail,
  validateEmail,
  validateInput,
  validatePassword,
} from '../../shared/validation.js';

async function handleSignup(
  _req: VercelRequest,
  res: VercelResponse,
  body: Record<string, unknown>,
) {
  const { email, password, firstName, lastName } = body;

  if (typeof firstName !== 'string' || !validateInput(firstName)) {
    return res.status(400).json({ message: 'First name is required' });
  }
  if (typeof lastName !== 'string' || !validateInput(lastName)) {
    return res.status(400).json({ message: 'Last name is required' });
  }
  if (typeof email !== 'string' || !validateEmail(email)) {
    return res.status(400).json({ message: 'Invalid email' });
  }
  if (typeof password !== 'string' || !validatePassword(password)) {
    return res.status(400).json({
      message:
        'Invalid password: use 8-20 characters with an uppercase letter, a lowercase letter, a number and a special character',
    });
  }

  const supabase = createAnonClient();
  const { data, error } = await supabase.auth.signUp({
    email: normalizeEmail(email),
    password,
    options: {
      data: { first_name: firstName.trim(), last_name: lastName.trim() },
    },
  });

  const isDuplicateEmail =
    error?.code === 'user_already_exists' ||
    data.user?.identities?.length === 0;
  if (isDuplicateEmail) {
    return res.status(400).json({ message: 'Unable to complete signup' });
  }

  if (isRateLimitError(error)) {
    return sendTooManyRequests(res);
  }

  if (error) {
    throw error;
  }

  return res.status(201).json({ message: 'Signup successful' });
}

export default withSentry(withMethod('POST', withObjectBody(handleSignup)));
