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
  type Category,
  type ProductStatus,
} from '../../../shared/products.js';
import { validateInput } from '../../../shared/validation.js';

const PRODUCT_COLUMNS = 'id, name, brand, category, status, note, created_at';

// Postgres text cannot hold a NUL character: it would fail at the insert and
// become a 500 reported to Sentry, so it is rejected up front with a 400.
const hasNulCharacter = (value: string) => value.includes('\u0000');

// Returns the trimmed value, or undefined when it is not a non-empty string
// within the limit.
function readText(value: unknown, maxLength: number): string | undefined {
  if (
    typeof value !== 'string' ||
    !validateInput(value) ||
    hasNulCharacter(value)
  ) {
    return undefined;
  }
  const trimmed = value.trim();
  return trimmed.length <= maxLength ? trimmed : undefined;
}

type ProductInput = {
  name: string;
  brand: string;
  category: Category;
  status: ProductStatus;
  note: string | null;
};

type ParsedProduct =
  { ok: true; value: ProductInput } | { ok: false; message: string };

const invalid = (message: string): ParsedProduct => ({ ok: false, message });

// Validates the body and returns the values to save (trimmed), or the message
// for the first invalid field.
function parseProductInput(body: Record<string, unknown>): ParsedProduct {
  const name = readText(body.name, PRODUCT_NAME_MAX_LENGTH);
  if (name === undefined) {
    return invalid(
      `Name is required (max ${PRODUCT_NAME_MAX_LENGTH} characters)`,
    );
  }
  const brand = readText(body.brand, PRODUCT_BRAND_MAX_LENGTH);
  if (brand === undefined) {
    return invalid(
      `Brand is required (max ${PRODUCT_BRAND_MAX_LENGTH} characters)`,
    );
  }
  const { category, status } = body;
  if (!isCategory(category)) {
    return invalid('Category must be skincare or makeup');
  }
  if (!isProductStatus(status)) {
    return invalid('Status must be new, used or finished');
  }

  // note is optional: missing, null or blank all mean "no note".
  let note: string | null = null;
  if (body.note !== undefined && body.note !== null) {
    if (typeof body.note !== 'string') {
      return invalid('Note must be a string');
    }
    if (hasNulCharacter(body.note)) {
      return invalid('Note contains invalid characters');
    }
    const trimmedNote = body.note.trim();
    if (trimmedNote.length > PRODUCT_NOTE_MAX_LENGTH) {
      return invalid(
        `Note is too long (max ${PRODUCT_NOTE_MAX_LENGTH} characters)`,
      );
    }
    note = trimmedNote === '' ? null : trimmedNote;
  }

  return { ok: true, value: { name, brand, category, status, note } };
}

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

// withAuth wraps withObjectBody (the opposite of the usual order) on purpose:
// the handler needs the auth context together with the body, and an anonymous
// caller must get 401 before any 415 or 400 about the body.
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
