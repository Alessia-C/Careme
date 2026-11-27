import type { Request, Response } from 'express';
import {
  sendTooManyRequests,
  withMethod,
  withObjectBody,
} from '../../_lib/http.js';
import { createAnonClient, isRateLimitError } from '../../_lib/supabase.js';
import {
  PASSWORD_POLICY_MESSAGE,
  PROFILE_NAME_MAX_LENGTH,
  normalizeEmail,
  profileNameError,
  readText,
  validateEmail,
  validatePassword,
} from '../../../shared/validation.js';

async function handleSignup(
  _req: Request,
  res: Response,
  body: Record<string, unknown>,
) {
  const { email, password } = body;

  const firstName = readText(body.firstName, PROFILE_NAME_MAX_LENGTH);
  if (firstName === undefined) {
    return res.status(400).json({ message: profileNameError('First name') });
  }
  const lastName = readText(body.lastName, PROFILE_NAME_MAX_LENGTH);
  if (lastName === undefined) {
    return res.status(400).json({ message: profileNameError('Last name') });
  }
  if (typeof email !== 'string' || !validateEmail(email)) {
    return res.status(400).json({ message: 'Invalid email' });
  }
  if (typeof password !== 'string' || !validatePassword(password)) {
    return res.status(400).json({ message: PASSWORD_POLICY_MESSAGE });
  }

  const supabase = createAnonClient();
  const { data, error } = await supabase.auth.signUp({
    email: normalizeEmail(email),
    password,
    options: {
      data: { first_name: firstName, last_name: lastName },
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

export default withMethod('POST', withObjectBody(handleSignup));
