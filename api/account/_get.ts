import type { Request, Response } from 'express';
import { withAuth, type AuthContext } from '../_lib/auth.js';
import { withMethod } from '../_lib/http.js';

// withAuth has already read the caller's profile with their own JWT, so no
// second query is needed. The email comes from the verified session: profiles
// has no email column and this endpoint cannot change it.
function handleGet(_req: Request, res: Response, auth: AuthContext) {
  // Personal data that depends on the cookie: no cache may keep it.
  res.setHeader('Cache-Control', 'no-store');

  return res.status(200).json({
    account: {
      first_name: auth.firstName,
      last_name: auth.lastName,
      email: auth.email,
    },
  });
}

export default withMethod('GET', withAuth(handleGet));
