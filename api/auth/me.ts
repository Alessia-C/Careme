import type { VercelRequest, VercelResponse } from '@vercel/node';
import { withAuth, type AuthContext } from '../_lib/auth.js';
import { withMethod } from '../_lib/http.js';
import { withSentry } from '../_lib/sentry.js';

// withAuth already verified the token and read the role from the database:
// the handler only echoes who the caller is, so the page can restore its
// in-memory session after a reload. Same user shape as the login response.
function handleMe(_req: VercelRequest, res: VercelResponse, auth: AuthContext) {
  return res.status(200).json({
    user: { id: auth.id, email: auth.email, role: auth.role },
  });
}

export default withSentry(withMethod('GET', withAuth(handleMe)));
