import type { Request, Response } from 'express';
import {
  sendTooManyRequests,
  withMethod,
  withObjectBody,
} from '../../_lib/http.js';
import { createAnonClient, isRateLimitError } from '../../_lib/supabase.js';
import { normalizeEmail, validateEmail } from '../../../shared/validation.js';

const RESET_PAGE_PATH = '/reset-password';

// The page the emailed link opens. It comes from the environment and never from
// the request: a caller-controlled address would be an open redirect that sends
// the reset token to another site. It must also be in the Redirect URLs of the
// Supabase project, otherwise Supabase ignores it.
function getResetPageUrl(): string {
  const appUrl = process.env.APP_URL;
  if (!appUrl) {
    throw new Error('Missing APP_URL environment variable');
  }
  return new URL(RESET_PAGE_PATH, appUrl).toString();
}

async function handleRecover(
  _req: Request,
  res: Response,
  body: Record<string, unknown>,
) {
  const { email } = body;

  // The format is the only thing that can be rejected: it says nothing about
  // which emails are registered.
  if (typeof email !== 'string' || !validateEmail(email)) {
    return res.status(400).json({ message: 'Invalid email' });
  }

  const supabase = createAnonClient();
  const { error } = await supabase.auth.resetPasswordForEmail(
    normalizeEmail(email),
    { redirectTo: getResetPageUrl() },
  );

  // The limit is project-wide, so it does not depend on the email either.
  if (isRateLimitError(error)) {
    return sendTooManyRequests(res);
  }
  // Supabase answers success for an unknown email too, so any error here is a
  // real fault and not a hint about the address.
  if (error) {
    throw error;
  }

  // Same response whether or not the email is registered (no enumeration).
  return res.status(200).json({
    message:
      'If the email is registered, you will receive a link to reset your password',
  });
}

export default withMethod('POST', withObjectBody(handleRecover));
