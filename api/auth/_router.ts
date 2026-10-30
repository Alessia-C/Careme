import { Router } from 'express';
import login from './_routes/login.js';
import logout from './_routes/logout.js';
import me from './_routes/me.js';
import refresh from './_routes/refresh.js';
import signup from './_routes/signup.js';

// router.all and not router.post/get: Express would answer a wrong method with
// the 404 page (or a 200 for OPTIONS), while the handlers return 405 through
// withMethod, as they did as separate functions.
// withAuth is applied per route and never with router.use: logout must stay
// reachable for a blocked user, so it does not use it.
// Case sensitive: /api/auth/LOGIN was never a valid URL for the function
// files. A Router does not inherit the app's setting, hence it is set here.
export const authRouter = Router({ caseSensitive: true });

authRouter.all('/login', login);
authRouter.all('/signup', signup);
authRouter.all('/logout', logout);
authRouter.all('/refresh', refresh);
authRouter.all('/me', me);
