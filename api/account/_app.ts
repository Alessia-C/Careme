import express from 'express';
import { notFound } from '../_lib/http.js';
import { errorHandler } from '../_lib/sentry.js';
import { accountRouter } from './_router.js';

// Exported without listen(): Vercel runs the app as the function handler, and
// the tests start it on an ephemeral port.
const app = express();

// Express adds both by default; every account response is personal data.
app.disable('x-powered-by');
app.set('etag', false);
// The app must be case sensitive: the Router's own setting never sees the
// /api/account prefix.
app.set('case sensitive routing', true);

// Order matters: body parsing, then the routes, then the catch-all 404 and
// finally the error handler, which must be the last one.
app.use(express.json({ limit: '10kb' }));
app.use('/api/account', accountRouter);
app.use(notFound);
app.use(errorHandler);

export default app;
