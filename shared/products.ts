// Shared with the frontend form, so both sides enforce the same rules.
export const PRODUCT_NAME_MAX_LENGTH = 100;
export const PRODUCT_BRAND_MAX_LENGTH = 100;
export const PRODUCT_NOTE_MAX_LENGTH = 500;

export type Category = 'skincare' | 'makeup';
export type ProductStatus = 'new' | 'used' | 'finished';

// The DB check constraints are the source of truth, but the value in a request
// body is untyped: validate it before trusting the type.
export const isCategory = (value: unknown): value is Category =>
  value === 'skincare' || value === 'makeup';

export const isProductStatus = (value: unknown): value is ProductStatus =>
  value === 'new' || value === 'used' || value === 'finished';
