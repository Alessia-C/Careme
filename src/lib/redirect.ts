// Only same-site paths are allowed after login. Checking the raw string is not
// enough: the browser's URL parser drops tabs and newlines and turns "\" into
// "/", so "/<TAB>/evil.example" becomes "//evil.example", another site. Parse
// it like the browser does and compare the origin instead.
export function getSafeNextPath(next: string | null): string {
  if (!next?.startsWith('/')) {
    return '/';
  }

  try {
    const url = new URL(next, window.location.origin);
    if (url.origin !== window.location.origin) {
      return '/';
    }
    return url.pathname + url.search + url.hash;
  } catch {
    return '/';
  }
}
