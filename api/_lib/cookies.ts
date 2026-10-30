import type { Request } from 'express';

// Express does not parse cookies and cookie-parser is not a dependency, so the
// Cookie header is read here. A pure function over the header (no middleware
// filling req.cookies, which @types/express types as `any`) keeps the result
// typed and needs no app-level setup.
//
// Returns the value only when it is a non-empty string. Of duplicated names the
// first one wins, like the `cookie` package. A value with a malformed %-escape
// is ignored instead of throwing: it would turn a bad header into a 500.
export function getCookie(req: Request, name: string): string | undefined {
  const header = req.headers.cookie;
  if (!header) {
    return undefined;
  }

  for (const pair of header.split(';')) {
    const separator = pair.indexOf('=');
    if (separator === -1) {
      continue;
    }
    if (pair.slice(0, separator).trim() !== name) {
      continue;
    }
    try {
      return decodeURIComponent(pair.slice(separator + 1).trim()) || undefined;
    } catch {
      return undefined;
    }
  }
  return undefined;
}
