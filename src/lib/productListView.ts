export type EmptyView = 'loading' | 'error' | 'first-access' | 'no-results';
export type ProductListView = EmptyView | 'list';

interface ViewState {
  isPending: boolean;
  hasListError: boolean;
  total: number;
  // True when the empty list is the answer to "no search", not to an old one.
  isFirstSearch: boolean;
}

export function getProductListView({
  isPending,
  hasListError,
  total,
  isFirstSearch,
}: ViewState): ProductListView {
  if (isPending) {
    return 'loading';
  }
  if (hasListError) {
    return 'error';
  }
  if (total > 0) {
    return 'list';
  }
  // The previous list stays on screen while a new search loads
  // (isPlaceholderData), so an empty one is not yet the answer for this search.
  return isFirstSearch ? 'first-access' : 'no-results';
}

interface AnnouncementState {
  view: ProductListView;
  shown: number;
  total: number;
  isPlaceholderData: boolean;
}

// Read out when a search or "Load more" changes the list: the list itself is
// not a live region, it would be read again in full.
export function getProductListAnnouncement({
  view,
  shown,
  total,
  isPlaceholderData,
}: AnnouncementState): string {
  if (isPlaceholderData) {
    return 'Loading products…';
  }
  if (view === 'list') {
    return `Showing ${shown} of ${total} products`;
  }
  return view === 'no-results' ? 'No product found' : '';
}
