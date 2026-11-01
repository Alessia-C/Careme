import type { Request, Response } from 'express';
import {
  requireAccessToken,
  withAuth,
  type AuthContext,
} from '../../_lib/auth.js';
import {
  sendTooManyRequests,
  withMethod,
  withObjectBody,
} from '../../_lib/http.js';
import { createUserClient, isRateLimitError } from '../../_lib/supabase.js';
import { PRODUCT_COLUMNS, isUuid } from '../../../shared/products.js';
import { parseProductInput } from '../_validation.js';

const sendNotFound = (res: Response) =>
  res.status(404).json({ message: 'Product not found' });

async function updateProduct(
  res: Response,
  auth: AuthContext,
  token: string,
  id: string,
  body: Record<string, unknown>,
) {
  const parsed = parseProductInput(body);
  if (!parsed.ok) {
    return res.status(400).json({ message: parsed.message });
  }
  const { name, brand, category, status, note } = parsed.value;

  // Acts as the caller, so RLS applies (same 'products' casts as create.ts).
  // Whitelist: only these fields are written, so an id, created_at or user_id
  // in the body can never reach the database and a product cannot change owner.
  // The filters below are the first line of defense, RLS the last: user_id is
  // checked here too. A single query is enough, because when no row is updated
  // the product is missing or belongs to someone else, and both answer 404.
  const supabase = createUserClient(token);
  const { data: product, error } = await supabase
    .from('products' as never)
    .update({ name, brand, category, status, note } as never)
    .eq('id', id)
    .eq('user_id', auth.id)
    .select(PRODUCT_COLUMNS)
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

// Same order as create: withAuth wraps withObjectBody, so an anonymous caller
// gets 401 before any 415 or 400 raised by this handler. The body parser of the
// app runs earlier: malformed or oversized JSON is a 400 even without a
// session. The id is checked before the body: a malformed id is answered as a
// missing product without calling the database, because Postgres would fail
// on it (a 500).
function handleUpdate(req: Request, res: Response, auth: AuthContext) {
  const { id } = req.params;
  if (!isUuid(id)) {
    return sendNotFound(res);
  }
  const token = requireAccessToken(req);
  return withObjectBody((_req, _res, body) =>
    updateProduct(res, auth, token, id, body),
  )(req, res);
}

export default withMethod('PUT', withAuth(handleUpdate));
