import type { Request, Response } from 'express';
import {
  requireAccessToken,
  withAuth,
  type AuthContext,
} from '../../_lib/auth.js';
import { sendTooManyRequests, withMethod } from '../../_lib/http.js';
import { createUserClient, isRateLimitError } from '../../_lib/supabase.js';
import { isUuid } from '../../../shared/products.js';

const sendNotFound = (res: Response) =>
  res.status(404).json({ message: 'Product not found' });

async function removeProduct(req: Request, res: Response, auth: AuthContext) {
  const { id } = req.params;
  // Postgres would fail on a malformed uuid (a 500): answer as if the product
  // did not exist, without calling the database.
  if (!isUuid(id)) {
    return sendNotFound(res);
  }

  // Acts as the caller, so RLS applies (same 'products' cast as create.ts).
  // user_id is filtered too: RLS is the last line of defense, this is the
  // first. A product of another user is not found, exactly like a missing
  // one, so the answer never tells whether an id exists.
  // select('id') makes the delete return the removed row: a delete matching
  // no row is not an error, and this is the only way to tell it from success.
  const supabase = createUserClient(requireAccessToken(req));
  const { data: removed, error } = await supabase
    .from('products' as never)
    .delete()
    .eq('id', id)
    .eq('user_id', auth.id)
    .select('id')
    .maybeSingle();
  if (isRateLimitError(error)) {
    return sendTooManyRequests(res);
  }
  if (error) {
    throw error;
  }
  if (!removed) {
    return sendNotFound(res);
  }

  return res.status(204).end();
}

export default withMethod('DELETE', withAuth(removeProduct));
