import type { Request, Response } from 'express';
import { getAccessToken, withAuth, type AuthContext } from '../../_lib/auth.js';
import {
  sendTooManyRequests,
  withMethod,
  withObjectBody,
} from '../../_lib/http.js';
import { createUserClient, isRateLimitError } from '../../_lib/supabase.js';
import {
  PRODUCT_BRAND_MAX_LENGTH,
  PRODUCT_NAME_MAX_LENGTH,
  PRODUCT_NOTE_MAX_LENGTH,
  isCategory,
  isProductStatus,
} from '../../../shared/products.js';
import { validateInput } from '../../../shared/validation.js';

const PRODUCT_COLUMNS = 'id, name, brand, category, status, note, created_at';

// Returns the trimmed value, or undefined when it is not a non-empty string
// within the limit.
function readText(value: unknown, maxLength: number): string | undefined {
  if (typeof value !== 'string' || !validateInput(value)) {
    return undefined;
  }
  const trimmed = value.trim();
  return trimmed.length <= maxLength ? trimmed : undefined;
}

async function createProduct(
  res: Response,
  auth: AuthContext,
  token: string,
  body: Record<string, unknown>,
) {
  const name = readText(body.name, PRODUCT_NAME_MAX_LENGTH);
  if (name === undefined) {
    return res.status(400).json({
      message: `Name is required`,
    });
  }
  const brand = readText(body.brand, PRODUCT_BRAND_MAX_LENGTH);
  if (brand === undefined) {
    return res.status(400).json({
      message: `Brand is required`,
    });
  }
  if (!isCategory(body.category)) {
    return res
      .status(400)
      .json({ message: 'Category must be skincare or makeup' });
  }
  if (!isProductStatus(body.status)) {
    return res
      .status(400)
      .json({ message: 'Status must be new, used or finished' });
  }

  // note is optional: missing, null or blank all mean "no note".
  let note: string | null = null;
  if (body.note !== undefined && body.note !== null) {
    if (typeof body.note !== 'string') {
      return res.status(400).json({ message: 'Note must be a string' });
    }
    note = body.note.trim() === '' ? null : body.note.trim();
    if (note !== null && note.length > PRODUCT_NOTE_MAX_LENGTH) {
      return res.status(400).json({
        message: `Note is too long (max ${PRODUCT_NOTE_MAX_LENGTH} characters)`,
      });
    }
  }

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
      category: body.category,
      status: body.status,
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

// withAuth runs first, so an anonymous caller gets 401 before any body check.
function handleCreate(req: Request, res: Response, auth: AuthContext) {
  const token = getAccessToken(req);
  if (!token) {
    // Unreachable: withAuth rejects requests without a token.
    throw new Error('Unexpected request without token');
  }
  return withObjectBody((_req, _res, body) =>
    createProduct(res, auth, token, body),
  )(req, res);
}

export default withMethod('POST', withAuth(handleCreate));
