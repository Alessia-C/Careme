import type { VercelRequest, VercelResponse } from '@vercel/node';
import {
  sendTooManyRequests,
  withMethod,
  withObjectBody,
} from '../_lib/http.js';
import { withSentry } from '../_lib/sentry.js';
import { createAnonClient, isRateLimitError } from '../_lib/supabase.js';
import {
  clearSessionCookies,
  getAccessToken,
  getRefreshToken,
  isInvalidSessionError,
  isRefreshTokenInvalid,
} from '../_lib/auth.js';

async function handleLogout(req: VercelRequest, res: VercelResponse) {
  // Both cookies are cleared first, on every outcome of this handler. The
  // client drops its local session whatever happens (shared devices), so the
  // browser must not keep a cookie that could still authenticate the next
  // person. If Supabase then fails, the token is not revoked but it is no
  // longer in the browser. The header survives the generic 500 sent by
  // withSentry. It is not sent on 405/415/400, rejected before this handler:
  // that is what stops a cross-site form from forcing a logout.
  clearSessionCookies(res);

  // Not withAuth on purpose: a blocked user must still be able to log out.
  const supabase = createAnonClient();
  let token = getAccessToken(req);

  if (!token) {
    // The access cookie lives as long as the access token, so it is usually
    // gone by the time the user logs out after a period of inactivity. The
    // refresh cookie is still there and Supabase would keep honouring it, so
    // it is swapped for a fresh access token that can be revoked.
    const refreshToken = getRefreshToken(req);
    if (!refreshToken) {
      return res
        .status(401)
        .json({ message: 'Missing or invalid authorization header' });
    }

    const { data, error: refreshError } = await supabase.auth.refreshSession({
      refresh_token: refreshToken,
    });
    if (isRateLimitError(refreshError)) {
      return sendTooManyRequests(res);
    }
    if (isRefreshTokenInvalid(refreshError)) {
      return res.status(401).json({ message: 'Session expired or invalid' });
    }
    if (refreshError) {
      throw refreshError;
    }
    if (!data.session) {
      throw new Error('Unexpected refresh without session');
    }
    token = data.session.access_token;
  }

  // The server keeps no session, so Supabase must be told which token to
  // revoke. Despite the "admin" namespace this only sends the caller's own JWT:
  // the anon client is enough and the service role key is not needed.
  // 'local' revokes only this session, not the user's other devices.
  const { error } = await supabase.auth.admin.signOut(token, 'local');

  if (isRateLimitError(error)) {
    return sendTooManyRequests(res);
  }

  // An expired, invalid or already revoked session is an expected case, not a
  // server fault: answer 401 (no Sentry noise) so the client drops its local
  // session and redirects to the login.
  if (isInvalidSessionError(error)) {
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
