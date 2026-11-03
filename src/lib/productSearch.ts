import { PRODUCT_SEARCH_MAX_LENGTH } from '../../shared/products';
import { hasNulCharacter } from '../../shared/validation';

// The same characters the API rejects (SEARCH_FORBIDDEN_CHARACTERS in
// api/products/_routes/list.ts): the server stays the one that decides, this
// only saves the user a round trip and a misleading generic error.
const SEARCH_FORBIDDEN_CHARACTERS = /[%_\\*",()]/;

// Returns the message to show for an invalid search term, null when it is fine.
export function getSearchError(term: string): string | null {
  const trimmedTerm = term.trim();
  if (trimmedTerm.length > PRODUCT_SEARCH_MAX_LENGTH) {
    return `Search is too long (max ${PRODUCT_SEARCH_MAX_LENGTH} characters)`;
  }
  if (
    hasNulCharacter(trimmedTerm) ||
    SEARCH_FORBIDDEN_CHARACTERS.test(trimmedTerm)
  ) {
    return 'Search contains invalid characters';
  }
  return null;
}
