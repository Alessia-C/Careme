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
