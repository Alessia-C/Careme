import type { VercelRequest, VercelResponse } from '@vercel/node';
import {
  getAccessToken,
  getTokenExpiry,
  withAuth,
  type AuthContext,
} from '../_lib/auth.js';
import { withMethod } from '../_lib/http.js';
import { withSentry } from '../_lib/sentry.js';

// withAuth already verified the token and read the role from the database:
// the handler only echoes who the caller is, so the page can restore its
// in-memory session after a reload. Same shape as the login response, expiry
// included, so the page can schedule the next renewal.
function handleMe(req: VercelRequest, res: VercelResponse, auth: AuthContext) {
  // Personal data that depends on the cookie: no cache may keep it.
  res.setHeader('Cache-Control', 'no-store');

  const token = getAccessToken(req);
  if (!token) {
    // Unreachable: withAuth rejects requests without a token.
    throw new Error('Unexpected request without token');
  }
  return res.status(200).json({
    user: { id: auth.id, email: auth.email, role: auth.role },
    expires_at: getTokenExpiry(token),
  });
}

export default withSentry(withMethod('GET', withAuth(handleMe)));
