import { Router } from 'express';
import { withMethods } from '../_lib/http.js';
import get from './_routes/get.js';
import password from './_routes/password.js';
import update from './_routes/update.js';

// router.all and not router.get/post: Express would answer a wrong method with
// the 404 page (or a 200 for OPTIONS), while the handlers return 405 through
// withMethod and withMethods.
// withAuth is applied per route and never with router.use, as in the auth app.
// Case sensitive: a Router does not inherit the app's setting, hence it is set
// here.
export const accountRouter = Router({ caseSensitive: true });

// GET /api/account and PUT /api/account
accountRouter.all('/', withMethods({ GET: get, PUT: update }));
// POST /api/account/password
accountRouter.all('/password', password);
