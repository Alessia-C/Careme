import type { Request, Response } from 'express';
import {
  requireAccessToken,
  withAuth,
  type AuthContext,
} from '../../_lib/auth.js';
import { sendTooManyRequests } from '../../_lib/http.js';
import { createUserClient, isRateLimitError } from '../../_lib/supabase.js';
import {
  PRODUCT_LIST_COLUMNS,
  PRODUCT_SEARCH_MAX_LENGTH,
  PRODUCTS_DEFAULT_LIMIT,
  PRODUCTS_MAX_LIMIT,
  isCategoryFilter,
  type Category,
} from '../../../shared/products.js';
import { hasNulCharacter } from '../../../shared/validation.js';

type ListFilters = {
  search: string | null;
  category: Category | null;
  limit: number;
  offset: number;
};

type ParsedFilters =
  { ok: true; value: ListFilters } | { ok: false; message: string };

const invalid = (message: string): ParsedFilters => ({ ok: false, message });

// Characters that are wildcards in LIKE (% _ \), in the PostgREST filter
// syntax (* , ( ) ") or that would close the quoted value. They are rejected
// instead of escaped: a product search never needs them.
const SEARCH_FORBIDDEN_CHARACTERS = /[%_\\*",()]/;

// Matches the \d{1,9} of parseIntegerParam: nine digits stay far below
// Number.MAX_SAFE_INTEGER.
const MAX_OFFSET = 999_999_999;

// A query parameter is a string, but Express also gives an array (?a=1&a=2) or
// an object (?a[b]=1): anything that is not a plain digit string is invalid.
function parseIntegerParam(
  rawValue: unknown,
  defaultValue: number,
  min: number,
  max: number,
): number | undefined {
  if (rawValue === undefined) {
    return defaultValue;
  }
  if (typeof rawValue !== 'string' || !/^\d{1,9}$/.test(rawValue)) {
    return undefined;
  }
  const parsedValue = Number(rawValue);
  return parsedValue >= min && parsedValue <= max ? parsedValue : undefined;
}

function parseListFilters(query: Request['query']): ParsedFilters {
  const limit = parseIntegerParam(
    query.limit,
    PRODUCTS_DEFAULT_LIMIT,
    1,
    PRODUCTS_MAX_LIMIT,
  );
  if (limit === undefined) {
    return invalid(`Limit must be between 1 and ${PRODUCTS_MAX_LIMIT}`);
  }
  const offset = parseIntegerParam(query.offset, 0, 0, MAX_OFFSET);
  if (offset === undefined) {
    return invalid('Offset must be a non-negative integer');
  }

  // "all" and a missing category both mean no filter.
  let category: Category | null = null;
  if (query.category !== undefined) {
    if (!isCategoryFilter(query.category)) {
      return invalid('Category must be skincare, makeup or all');
    }
    category = query.category === 'all' ? null : query.category;
  }

  // A blank search counts as a missing one.
  let search: string | null = null;
  if (query.search !== undefined) {
    if (typeof query.search !== 'string') {
      return invalid('Search must be a string');
    }
    const trimmedSearch = query.search.trim();
    if (trimmedSearch.length > PRODUCT_SEARCH_MAX_LENGTH) {
      return invalid(
        `Search is too long (max ${PRODUCT_SEARCH_MAX_LENGTH} characters)`,
      );
    }
    if (
      hasNulCharacter(trimmedSearch) ||
      SEARCH_FORBIDDEN_CHARACTERS.test(trimmedSearch)
    ) {
      return invalid('Search contains invalid characters');
    }
    search = trimmedSearch === '' ? null : trimmedSearch;
  }

  return { ok: true, value: { search, category, limit, offset } };
}

async function listProducts(req: Request, res: Response, auth: AuthContext) {
  const parsedFilters = parseListFilters(req.query);
  if (!parsedFilters.ok) {
    return res.status(400).json({ message: parsedFilters.message });
  }
  const { search, category, limit, offset } = parsedFilters.value;

  // Acts as the caller, so RLS applies. The 'products' cast is the same
  // justified exception as in create.ts: the generated DB types are still
  // empty. user_id is filtered too: RLS is the last line of defense, this is
  // the first.
  const supabase = createUserClient(requireAccessToken(req));
  let query = supabase
    .from('products' as never)
    .select(PRODUCT_LIST_COLUMNS, { count: 'exact' })
    .eq('user_id', auth.id);
  if (category) {
    query = query.eq('category', category);
  }
  if (search) {
    // The name ignores the case, the brand does not. The value is quoted so
    // that the PostgREST syntax characters are read as text.
    query = query.or(`name.ilike."*${search}*",brand.like."*${search}*"`);
  }

  // id breaks the ties, so the pages stay stable when created_at repeats.
  // range() includes both ends.
  const {
    data: products,
    count: total,
    error,
  } = await query
    .order('created_at', { ascending: false })
    .order('id', { ascending: false })
    .range(offset, offset + limit - 1);
  if (isRateLimitError(error)) {
    return sendTooManyRequests(res);
  }
  if (error) {
    throw error;
  }

  return res.status(200).json({ products, total });
}

// The method is checked by the router (withMethods), which serves GET and POST
// on this path.
export default withAuth(listProducts);
