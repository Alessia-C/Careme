import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';
import { withSentry } from '../_lib/sentry.js';
import {
  validateEmail,
  validateInput,
  validatePassword,
} from '../../shared/validation.js';

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

async function handleSignup(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method not allowed' });
  }

  if (!isObject(req.body)) {
    return res.status(400).json({ message: 'Missing or invalid request body' });
  }

  const { email, password, firstName, lastName } = req.body;

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

  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseAnonKey = process.env.SUPABASE_ANON_KEY;
  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error('Missing Supabase environment variables');
  }

  const supabase = createClient(supabaseUrl, supabaseAnonKey);
  const { data, error } = await supabase.auth.signUp({
    email: email.trim().toLowerCase(),
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

  // Supabase limits confirmation emails project-wide: not a server fault, so
  // answer 429 instead of a 500 that would also pollute Sentry.
  const isRateLimited =
    error?.code === 'over_email_send_rate_limit' ||
    error?.code === 'over_request_rate_limit';
  if (isRateLimited) {
    return res
      .status(429)
      .json({ message: 'Too many requests, please try again later' });
  }

  if (error) {
    throw error;
  }

  return res.status(201).json({ message: 'Signup successful' });
}

export default withSentry(handleSignup);
