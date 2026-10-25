// Only same-site paths are allowed after login: anything else (another origin,
// a protocol-relative "//host" or "/\host") would be an open redirect.
export function getSafeNextPath(next: string | null): string {
  const isInternalPath =
    next !== null &&
    next.startsWith('/') &&
    !next.startsWith('//') &&
    !next.startsWith('/\\');

  return isInternalPath ? next : '/';
}
