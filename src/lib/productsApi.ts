import type { QueryClient } from '@tanstack/react-query';
import { apiFetch, UnauthorizedError } from './apiFetch';
import {
  isCategory,
  isProductStatus,
  type Category,
  type ProductStatus,
} from '../../shared/products';
import { isObject } from '../../shared/validation';

// Prefix of every products query.
export const PRODUCTS_QUERY_KEY = ['products'] as const;

// Prefix of the list queries, one per search term. Creating a product
// invalidates this one: the details already loaded do not change with it.
// Updating one also refreshes its detail: see cacheUpdatedProduct.
export const PRODUCTS_LIST_QUERY_KEY = [...PRODUCTS_QUERY_KEY, 'list'] as const;

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

// The columns of PRODUCT_COLUMNS the page uses: the detail adds the note.
export interface Product extends ProductListItem {
  // null when the user left the note empty.
  note: string | null;
}

export const productDetailKey = (id: string | null) =>
  [...PRODUCTS_QUERY_KEY, 'detail', id] as const;

export type GetProductResult =
  | { ok: true; product: Product }
  | { ok: false; reason: 'not-found' }
  | ApiFailure;

const isProduct = (item: unknown): item is Product =>
  isObject(item) &&
  isProductListItem(item) &&
  (item.note === null || typeof item.note === 'string');

export async function getProduct(id: string): Promise<GetProductResult> {
  const response = await request(`/api/products/${encodeURIComponent(id)}`);
  // A 403 (blocked user) is shown like a 404: the user cannot see the product
  // either way, and the screen never tells whether an id exists.
  if (response?.status === 404 || response?.status === 403) {
    return { ok: false, reason: 'not-found' };
  }
  if (!response?.ok) {
    return toFailure(response);
  }

  const body: unknown = await response.json().catch(() => null);
  return isObject(body) && isProduct(body.product)
    ? { ok: true, product: body.product }
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

export type UpdateProductResult =
  | { ok: true; product: Product }
  | { ok: false; reason: 'not-found' }
  | ApiFailure;

// Replaces every field of the product (the API validates the whole body).
export async function updateProduct(
  id: string,
  input: ProductInput,
): Promise<UpdateProductResult> {
  const response = await request(`/api/products/${encodeURIComponent(id)}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });
  // Same as getProduct: a 403 (blocked user) is shown like a 404.
  if (response?.status === 404 || response?.status === 403) {
    return { ok: false, reason: 'not-found' };
  }
  if (!response?.ok) {
    return toFailure(response);
  }

  const body: unknown = await response.json().catch(() => null);
  return isObject(body) && isProduct(body.product)
    ? { ok: true, product: body.product }
    : { ok: false, reason: 'failed' };
}

// The PUT answers with the whole product, so its detail is written in the
// cache instead of asked again; only the lists, which show name, brand and
// the rest of it, are.
export function cacheUpdatedProduct(
  queryClient: QueryClient,
  product: Product,
) {
  const detailKey = productDetailKey(product.id);
  // A request for the detail still on its way would bring the old product
  // after this one is written. The cancel takes effect right away.
  void queryClient.cancelQueries({ queryKey: detailKey });
  queryClient.setQueryData(detailKey, product);
  void queryClient.invalidateQueries({ queryKey: PRODUCTS_LIST_QUERY_KEY });
}

export type DeleteProductResult = { ok: true } | ApiFailure;

export async function deleteProduct(id: string): Promise<DeleteProductResult> {
  const response = await request(`/api/products/${encodeURIComponent(id)}`, {
    method: 'DELETE',
  });
  // A 403 means the account was blocked after the session started: retrying
  // cannot help, so it ends the session like a 401 (the MutationCache sends
  // the user to /login), as the session restore does for 401 and 403.
  if (response?.status === 403) {
    throw new UnauthorizedError();
  }
  // A 404 is a success for the user: the product is already gone (deleted from
  // another tab) or is not theirs, and either way it is not in their list.
  return response?.ok || response?.status === 404
    ? { ok: true }
    : toFailure(response);
}
