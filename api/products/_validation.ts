import {
  PRODUCT_BRAND_MAX_LENGTH,
  PRODUCT_NAME_MAX_LENGTH,
  PRODUCT_NOTE_MAX_LENGTH,
  isCategory,
  isProductStatus,
  type Category,
  type ProductStatus,
} from '../../shared/products.js';
import { hasNulCharacter, validateInput } from '../../shared/validation.js';

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

export type ProductInput = {
  name: string;
  brand: string;
  category: Category;
  status: ProductStatus;
  note: string | null;
};

export type ParsedProduct =
  { ok: true; value: ProductInput } | { ok: false; message: string };

const invalid = (message: string): ParsedProduct => ({ ok: false, message });

// Validates the body and returns the values to save (trimmed), or the message
// for the first invalid field. Shared by create and update: both take the
// whole product, so they must accept exactly the same input.
export function parseProductInput(
  body: Record<string, unknown>,
): ParsedProduct {
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
