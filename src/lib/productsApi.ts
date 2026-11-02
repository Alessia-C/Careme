import { apiFetch, UnauthorizedError } from './apiFetch';
import {
  isCategory,
  isProductStatus,
  type Category,
  type ProductStatus,
} from '../../shared/products';
import { isObject } from '../../shared/validation';

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

// The columns of PRODUCT_LIST_COLUMNS the page uses: the list leaves out the
// note.
export interface ProductListItem {
  id: string;
  name: string;
  brand: string;
  category: Category;
  status: ProductStatus;
}

export interface ListProductsParams {
  search: string;
  offset: number;
  limit: number;
}

export type ListProductsResult =
  { ok: true; products: ProductListItem[]; total: number } | ApiFailure;

const isProductListItem = (item: unknown): item is ProductListItem =>
  isObject(item) &&
  typeof item.id === 'string' &&
  typeof item.name === 'string' &&
  typeof item.brand === 'string' &&
  isCategory(item.category) &&
  isProductStatus(item.status);

const isProductListPage = (
  body: unknown,
): body is { products: ProductListItem[]; total: number } =>
  isObject(body) &&
  Array.isArray(body.products) &&
  body.products.every(isProductListItem) &&
  typeof body.total === 'number';

export async function listProducts({
  search,
  offset,
  limit,
}: ListProductsParams): Promise<ListProductsResult> {
  const params = new URLSearchParams({
    offset: String(offset),
    limit: String(limit),
  });
  if (search) {
    params.set('search', search);
  }

  const response = await request(`/api/products?${params}`);
  if (!response?.ok) {
    return toFailure(response);
  }

  // A body that is not a page (an HTML fallback, an item without its fields)
  // is a failure for the user, not a reason to crash the render.
  const body: unknown = await response.json().catch(() => null);
  return isProductListPage(body)
    ? { ok: true, products: body.products, total: body.total }
    : { ok: false, reason: 'failed' };
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
