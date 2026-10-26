import type { VercelRequest, VercelResponse } from '@vercel/node';
import {
  isAuthApiError,
  isAuthSessionMissingError,
} from '@supabase/supabase-js';
import {
  sendTooManyRequests,
  withMethod,
  withObjectBody,
} from '../_lib/http.js';
import { withSentry } from '../_lib/sentry.js';
import { createAnonClient, isRateLimitError } from '../_lib/supabase.js';
import { buildClearedSessionCookie, getAccessToken } from '../_lib/auth.js';

// Same statuses supabase-js itself ignores on sign out: the JWT is invalid or
// expired (401), forbidden (403) or the user no longer exists (404). An
// already revoked session is not listed here: supabase-js reports it as an
// AuthSessionMissingError instead of an AuthApiError.
const SESSION_INVALID_STATUSES = [401, 403, 404];

async function handleLogout(req: VercelRequest, res: VercelResponse) {
  // The cookie is cleared first, on every outcome of this handler. The client
  // drops its local session whatever happens (shared devices), so the browser
  // must not keep a cookie that could still authenticate the next person. If
  // Supabase then fails, the token is not revoked but it is no longer in the
  // browser. The header survives the generic 500 sent by withSentry. It is not
  // sent on 405/415/400, rejected before this handler: that is what stops a
  // cross-site form from forcing a logout.
  res.setHeader('Set-Cookie', buildClearedSessionCookie());

  // Not withAuth on purpose: a blocked user must still be able to log out.
  const token = getAccessToken(req);

  if (!token) {
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

// withObjectBody is only a CSRF defence here (the body is ignored): a cross-site
// <form> cannot send application/json without a CORS preflight, so it cannot
// force a logout.
export default withSentry(withMethod('POST', withObjectBody(handleLogout)));
