import { useCallback, useState } from 'react';
import PageHeader from '../../components/PageHeader/PageHeader';
import { useProducts } from '../../hooks/useProducts/useProducts';
import AddProductDrawer from './components/AddProductDrawer/AddProductDrawer';
import ProductListSection from './components/ProductListSection/ProductListSection';
import ProductSearch from './components/ProductSearch/ProductSearch';
import ProductsEmptyState, {
  type EmptyView,
} from './components/ProductsEmptyState/ProductsEmptyState';
import styles from './HomePage.module.css';

type View = EmptyView | 'list';

interface ViewState {
  isPending: boolean;
  hasListError: boolean;
  total: number;
  // True when the empty list is the answer to "no search", not to an old one.
  isFirstSearch: boolean;
}

function getView({
  isPending,
  hasListError,
  total,
  isFirstSearch,
}: ViewState): View {
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

// Read out when a search or "Load more" changes the list: the list itself is
// not a live region, it would be read again in full.
function getAnnouncement(
  view: View,
  shown: number,
  total: number,
  isPlaceholderData: boolean,
) {
  if (isPlaceholderData) {
    return 'Loading products…';
  }
  if (view === 'list') {
    return `Showing ${shown} of ${total} products`;
  }
  return view === 'no-results' ? 'No product found' : '';
}

function HomePage() {
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  // A new key remounts the drawer, so the form starts empty every time it
  // opens. The drawer is not remounted on close: the native dialog gives the
  // focus back to this button.
  const [drawerKey, setDrawerKey] = useState(0);
  const [search, setSearch] = useState('');
  // The product detail drawer is a later issue: for now the Detail button only
  // records which product was chosen.
  const [, setSelectedProductId] = useState<string | null>(null);

  const {
    products,
    total,
    isPending,
    isError,
    isFetchNextPageError,
    isPlaceholderData,
    hasNextPage,
    isFetchingNextPage,
    fetchNextPage,
    refetch,
  } = useProducts(search);

  const openDrawer = useCallback(() => {
    setDrawerKey((key) => key + 1);
    setIsDrawerOpen(true);
  }, []);

  const closeDrawer = useCallback(() => setIsDrawerOpen(false), []);
  // Stable, so the memoized empty state is not rendered again with the page.
  const retry = useCallback(() => void refetch(), [refetch]);

  const view = getView({
    isPending,
    // A failed "Load more" keeps the products already shown: only a failure of
    // the whole list replaces it.
    hasListError: isError && !isFetchNextPageError,
    total,
    isFirstSearch: search === '' && !isPlaceholderData,
  });
  // The header and the search come after the first load, and not on the first
  // access state, which has its own title and Add product button.
  const showHeader = view !== 'loading' && view !== 'first-access';

  return (
    <div className={styles.page}>
      <title>Careme</title>
      {showHeader && (
        <>
          <PageHeader
            title="Your products"
            actionLabel="Add product"
            onAction={openDrawer}
          />
          <ProductSearch disabled onSearch={setSearch} />
          <p className={styles.visuallyHidden} role="status">
            {getAnnouncement(view, products.length, total, isPlaceholderData)}
          </p>
        </>
      )}

      {view === 'list' ? (
        <ProductListSection
          products={products}
          isBusy={isPlaceholderData}
          hasNextPage={hasNextPage}
          isFetchingNextPage={isFetchingNextPage}
          isFetchNextPageError={isFetchNextPageError}
          onDetail={setSelectedProductId}
          onLoadMore={() => void fetchNextPage()}
        />
      ) : (
        <ProductsEmptyState view={view} onRetry={retry} onAdd={openDrawer} />
      )}

      <AddProductDrawer
        key={drawerKey}
        open={isDrawerOpen}
        onClose={closeDrawer}
      />
    </div>
  );
}

export default HomePage;
