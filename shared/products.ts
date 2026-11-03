// Shared with the frontend form, so both sides enforce the same rules.
export const PRODUCT_NAME_MAX_LENGTH = 100;
export const PRODUCT_BRAND_MAX_LENGTH = 100;
export const PRODUCT_NOTE_MAX_LENGTH = 500;

// Product list: search term length and page size.
export const PRODUCT_SEARCH_MAX_LENGTH = 100;
export const PRODUCTS_DEFAULT_LIMIT = 10;
export const PRODUCTS_MAX_LIMIT = 20;

// Columns read from the products table. The list leaves out the note, which
// can be long and is only shown in the detail.
export const PRODUCT_LIST_COLUMNS =
  'id, name, brand, category, status, created_at';
export const PRODUCT_COLUMNS =
  'id, name, brand, category, status, note, created_at';

export type Category = 'skincare' | 'makeup';
export type CategoryFilter = Category | 'all';
export type ProductStatus = 'new' | 'used' | 'finished';

// The DB check constraints are the source of truth, but the value in a request
// body is untyped: validate it before trusting the type.
export const isCategory = (value: unknown): value is Category =>
  value === 'skincare' || value === 'makeup';

export const isCategoryFilter = (value: unknown): value is CategoryFilter =>
  value === 'all' || isCategory(value);

export const isProductStatus = (value: unknown): value is ProductStatus =>
  value === 'new' || value === 'used' || value === 'finished';

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Postgres rejects a malformed uuid with an error (a 500), so an id from the
// URL is checked before it reaches the database.
export const isUuid = (value: unknown): value is string =>
  typeof value === 'string' && UUID_REGEX.test(value);
