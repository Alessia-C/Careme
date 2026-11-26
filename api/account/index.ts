// The only function of the account domain: it serves /api/account alone, so no
// catch-all is needed. The other files start with _ and are bundled into it.
import express from 'express';
import { notFound, withMethods } from '../_lib/http.js';
import { errorHandler } from '../_lib/sentry.js';
import get from './_get.js';
import update from './_update.js';

// Exported without listen(): Vercel runs the app as the function handler, and
// the tests start it on an ephemeral port.
const app = express();

// Express adds both by default; every account response is personal data.
app.disable('x-powered-by');
app.set('etag', false);
app.set('case sensitive routing', true);

// Order matters: body parsing, then the route, then the catch-all 404 and
// finally the error handler, which must be the last one.
app.use(express.json({ limit: '10kb' }));
// app.all and not app.get/put: Express would answer a wrong method with the 404
// page, while withMethods returns 405. withAuth is applied by each handler.
app.all('/api/account', withMethods({ GET: get, PUT: update }));
app.use(notFound);
app.use(errorHandler);

export default app;
