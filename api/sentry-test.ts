import type { VercelRequest, VercelResponse } from '@vercel/node';
import { withSentry } from './_lib/sentry.js';

export default withSentry((_req: VercelRequest, res: VercelResponse) => {
  if (process.env.VERCEL_ENV === 'production') {
    return res.status(404).json({ status: 'error', message: 'Not found' });
  }
  throw new Error('Sentry backend test error');
});
