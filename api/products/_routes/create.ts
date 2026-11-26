import type { Request, Response } from 'express';
import {
  handleTokenAndBody,
  withAuth,
  type AuthContext,
} from '../../_lib/auth.js';
import { sendTooManyRequests, withMethod } from '../../_lib/http.js';
import { createUserClient, isRateLimitError } from '../../_lib/supabase.js';
import { PRODUCT_COLUMNS } from '../../../shared/products.js';
import { parseProductInput } from '../_validation.js';

async function createProduct(
  res: Response,
  auth: AuthContext,
  token: string,
  body: Record<string, unknown>,
) {
  const parsed = parseProductInput(body);
  if (!parsed.ok) {
    return res.status(400).json({ message: parsed.message });
  }
  const { name, brand, category, status, note } = parsed.value;

  // Acts as the caller, so RLS applies. The casts are the same justified
  // exception as the 'profiles' ones: the generated DB types are still empty.
  const supabase = createUserClient(token);

  // Informative only: there is no unique constraint, so the product is created
  // anyway. The match is exact (case sensitive), and it runs before the insert
  // so the new row cannot match itself.
  const { data: existing, error: duplicateError } = await supabase
    .from('products' as never)
    .select('id')
    .eq('user_id', auth.id)
    .eq('name', name)
    .eq('brand', brand)
    .limit(1)
    .maybeSingle();
  if (isRateLimitError(duplicateError)) {
    return sendTooManyRequests(res);
  }
  if (duplicateError) {
    throw duplicateError;
  }
  // Same reason as the casts above: without generated DB types `existing` has
  // no type. Only the id is read, and it is only echoed back to the caller.
  const duplicateOf = (existing as { id?: string } | null)?.id ?? null;

  // Whitelist: only these fields are inserted, so an id, created_at or
  // user_id in the body can never reach the database. user_id comes from the
  // verified token.
  const { data: product, error } = await supabase
    .from('products' as never)
    .insert({
      user_id: auth.id,
      name,
      brand,
      category,
      status,
      note,
    } as never)
    .select(PRODUCT_COLUMNS)
    .single();
  if (isRateLimitError(error)) {
    return sendTooManyRequests(res);
  }
  if (error) {
    throw error;
  }

  return res
    .status(201)
    .json({ product, duplicate: duplicateOf !== null, duplicateOf });
}

// The body is checked inside withAuth (the opposite of the usual order) on
// purpose: the handler needs the auth context together with the body.
function handleCreate(req: Request, res: Response, auth: AuthContext) {
  return handleTokenAndBody(req, res, (token, body) =>
    createProduct(res, auth, token, body),
  );
}

export default withMethod('POST', withAuth(handleCreate));
