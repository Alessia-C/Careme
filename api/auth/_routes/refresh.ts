import type { Request, Response } from 'express';
import {
  clearSessionCookies,
  getAccessToken,
  getRefreshToken,
  getSessionExpiry,
  isAccountActive,
  isRefreshTokenInvalid,
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

function sendSessionEnded(res: Response, status: number, message: string) {
  // Without a valid session the cookies are useless: remove them so the
  // browser stops sending them and the user has to log in again.
  clearSessionCookies(res);
  return res.status(status).json({ message });
}

async function handleRefresh(req: Request, res: Response) {
  // The response carries cookies tied to the caller: no cache may keep it.
  res.setHeader('Cache-Control', 'no-store');

  const refreshToken = getRefreshToken(req);
  if (!refreshToken) {
    return sendSessionEnded(res, 401, 'Missing refresh token');
  }
  // The refresh cookie may survive a browser restart, but the access cookie
  // expires with the access token: without it the inactivity limit has passed
  // and whoever holds the refresh cookie must sign in again. Only its presence
  // is checked, the refresh token is what Supabase validates.
  if (!getAccessToken(req)) {
    return sendSessionEnded(res, 401, 'Session expired or invalid');
  }

  // Supabase rotates the refresh token: the old one stops working as soon as
  // this call succeeds, so the new one must reach the browser.
  const supabase = createAnonClient();
  const { data, error } = await supabase.auth.refreshSession({
    refresh_token: refreshToken,
  });

  if (isRateLimitError(error)) {
    return sendTooManyRequests(res);
  }
  if (isRefreshTokenInvalid(error)) {
    return sendSessionEnded(res, 401, 'Session expired or invalid');
  }
  if (error) {
    throw error;
  }
  if (!data.session) {
    throw new Error('Unexpected refresh without session');
  }

  // A blocked user must not get a new session: check with the new JWT (RLS
  // applies) before the cookies are set, and drop the old ones.
  const userClient = createUserClient(data.session.access_token);
  if (!(await isAccountActive(userClient))) {
    // The rotation already happened: revoke the new session too.
    await revokeSessionBestEffort(supabase, data.session.access_token);
    return sendSessionEnded(res, 403, 'Account blocked');
  }

  setSessionCookies(res, data.session);

  return res.status(200).json({ expires_at: getSessionExpiry(data.session) });
}

// withObjectBody is a CSRF defence here (the body is ignored): a cross-site
// <form> cannot send application/json without a CORS preflight.
export default withMethod('POST', withObjectBody(handleRefresh));
