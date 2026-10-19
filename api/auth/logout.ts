import type { VercelRequest, VercelResponse } from '@vercel/node';
import {
  isAuthApiError,
  isAuthSessionMissingError,
} from '@supabase/supabase-js';
import { sendTooManyRequests, withMethod } from '../_lib/http.js';
import { withSentry } from '../_lib/sentry.js';
import { createAnonClient, isRateLimitError } from '../_lib/supabase.js';

// Same statuses supabase-js itself ignores on sign out: the JWT is invalid or
// expired (401), forbidden (403) or the user no longer exists (404). An
// already revoked session is not listed here: supabase-js reports it as an
// AuthSessionMissingError instead of an AuthApiError.
const SESSION_INVALID_STATUSES = [401, 403, 404];

async function handleLogout(req: VercelRequest, res: VercelResponse) {
  // The token is read from the header and not from the body: a logout has no
  // body and the same header is how every protected endpoint will be called.
  const authHeader = req.headers.authorization;
  const prefix = 'Bearer ';
  const token = authHeader ? authHeader.slice(prefix.length) : undefined;
  const isTokenEmpty = token === '' || token === undefined;
  const isAuthHeaderMissing = !authHeader || !authHeader.startsWith(prefix);

  if (isTokenEmpty || isAuthHeaderMissing) {
    return res
      .status(401)
      .json({ message: 'Missing or invalid authorization header' });
  }

  // The server keeps no session, so Supabase must be told which token to
  // revoke. Despite the "admin" namespace this only sends the caller's own JWT:
  // the anon client is enough and the service role key is not needed.
  // 'local' revokes only this session, not the user's other devices.
  const supabase = createAnonClient();
  const { error } = await supabase.auth.admin.signOut(token, 'local');

  if (isRateLimitError(error)) {
    return sendTooManyRequests(res);
  }

  // An expired, invalid or already revoked session is an expected case, not a
  // server fault: answer 401 (no Sentry noise) so the client drops its local
  // session and redirects to the login.
  if (
    isAuthSessionMissingError(error) ||
    (isAuthApiError(error) && SESSION_INVALID_STATUSES.includes(error.status))
  ) {
    return res.status(401).json({ message: 'Session expired or invalid' });
  }

  if (error) {
    throw error;
  }

  return res.status(200).json({ message: 'Logged out successfully' });
}

export default withSentry(withMethod('POST', handleLogout));
