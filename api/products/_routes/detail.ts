import type { Request, Response } from 'express';
import {
  requireAccessToken,
  withAuth,
  type AuthContext,
} from '../../_lib/auth.js';
import { sendTooManyRequests, withMethod } from '../../_lib/http.js';
import { createUserClient, isRateLimitError } from '../../_lib/supabase.js';
import { PRODUCT_COLUMNS, isUuid } from '../../../shared/products.js';

const sendNotFound = (res: Response) =>
  res.status(404).json({ message: 'Product not found' });

async function getProduct(req: Request, res: Response, auth: AuthContext) {
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
  const supabase = createUserClient(requireAccessToken(req));
  const { data: product, error } = await supabase
    .from('products' as never)
    .select(PRODUCT_COLUMNS)
    .eq('id', id)
    .eq('user_id', auth.id)
    .maybeSingle();
  if (isRateLimitError(error)) {
    return sendTooManyRequests(res);
  }
  if (error) {
    throw error;
  }
  if (!product) {
    return sendNotFound(res);
  }

  return res.status(200).json({ product });
}

export default withMethod('GET', withAuth(getProduct));
