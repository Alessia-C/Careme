import { apiFetch, UnauthorizedError } from './apiFetch';
import type { Category, ProductStatus } from '../../shared/products';

// Prefix of every products query: invalidating it refreshes all the lists.
export const PRODUCTS_QUERY_KEY = ['products'] as const;

export interface ProductInput {
  name: string;
  brand: string;
  category: Category;
  status: ProductStatus;
  note: string;
}

type ApiFailure = { ok: false; reason: 'rate-limited' | 'failed' };

// Network errors become a failure the form can show. A 401 is not one of
// them: apiFetch throws UnauthorizedError and it is left to propagate, so the
// MutationCache sends the user back to /login (see queryClient.ts).
async function request(path: string, init?: RequestInit) {
  try {
    return await apiFetch(path, init);
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      throw error;
    }
    return null;
  }
}

function toFailure(response: Response | null): ApiFailure {
  return {
    ok: false,
    reason: response?.status === 429 ? 'rate-limited' : 'failed',
  };
}

// True only when the first product is exactly the one asked for. The API
// filters by name and brand, but if a filter were ignored the list would hold
// an unrelated product: that must never block the user, so it is checked here
// too. The comparison is the same as the API's: trimmed values.
function isSameProduct(body: unknown, name: string, brand: string) {
  // The casts only name the fields to check: the body is unknown and every
  // value is compared strictly right below.
  const products = (body as { products?: unknown } | null)?.products;
  if (!Array.isArray(products) || products.length === 0) {
    return false;
  }
  const first = products[0] as { name?: unknown; brand?: unknown } | null;
  return first?.name === name && first?.brand === brand;
}

export type FindDuplicateResult = { ok: true; duplicate: boolean } | ApiFailure;

export async function findDuplicate(
  name: string,
  brand: string,
): Promise<FindDuplicateResult> {
  const trimmedName = name.trim();
  const trimmedBrand = brand.trim();
  const query = new URLSearchParams({
    name: trimmedName,
    brand: trimmedBrand,
    limit: '1',
  });

  const response = await request(`/api/products?${query}`);
  if (!response?.ok) {
    return toFailure(response);
  }

  try {
    const body: unknown = await response.json();
    return {
      ok: true,
      duplicate: isSameProduct(body, trimmedName, trimmedBrand),
    };
  } catch {
    // json() rejects on a malformed body.
    return { ok: false, reason: 'failed' };
  }
}

export type CreateProductResult = { ok: true } | ApiFailure;

export async function createProduct(
  input: ProductInput,
): Promise<CreateProductResult> {
  const response = await request('/api/products', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });

  return response?.ok ? { ok: true } : toFailure(response);
}

export type AddProductResult =
  { ok: true } | { ok: false; reason: 'duplicate' | 'rate-limited' | 'failed' };

// Checks for a product with the same name and brand before creating, so the
// user can change them instead of ending up with two. The check and the
// creation are two requests: it is a help for the user, not a guarantee.
export async function addProduct(
  input: ProductInput,
): Promise<AddProductResult> {
  const duplicate = await findDuplicate(input.name, input.brand);
  if (!duplicate.ok) {
    return duplicate;
  }
  if (duplicate.duplicate) {
    return { ok: false, reason: 'duplicate' };
  }
  return createProduct(input);
}
