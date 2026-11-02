import { useCallback, useState } from 'react';
import Button from '../../components/Button/Button';
import ContentState from '../../components/ContentState/ContentState';
import Feedback from '../../components/Feedback/Feedback';
import PageHeader from '../../components/PageHeader/PageHeader';
import plusIcon from '../../assets/icons/plus.svg';
import { useProducts } from '../../hooks/useProducts/useProducts';
import AddProductDrawer from './components/AddProductDrawer/AddProductDrawer';
import ProductList from './components/ProductList/ProductList';
import ProductSearch from './components/ProductSearch/ProductSearch';
import styles from './HomePage.module.css';

type View = 'loading' | 'error' | 'first-access' | 'no-results' | 'list';

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
        <PageHeader
          title="Your products"
          actionLabel="Add product"
          onAction={openDrawer}
        />
      )}

      {/* Disabled until the search has its own issue: the field is in the design,
          but its behavior is not part of the product list story. */}
      {showHeader && <ProductSearch disabled onSearch={setSearch} />}

      {showHeader && (
        <p className={styles.visuallyHidden} role="status">
          {getAnnouncement(view, products.length, total, isPlaceholderData)}
        </p>
      )}

      {view === 'loading' && (
        <ContentState status="loading" title="Loading products…" />
      )}

      {view === 'error' && (
        <ContentState
          status="error"
          title="We couldn’t load your products"
          text="Please check your connection and try again."
        >
          <div className={styles.action}>
            <Button label="Try again" onClick={() => void refetch()} />
          </div>
        </ContentState>
      )}

      {view === 'first-access' && (
        <ContentState
          title="Add your product"
          text="Start by adding your first product to manage your catalog"
          icon={
            <div className={styles.icon}>
              <img src={plusIcon} alt="" width={32} height={32} />
            </div>
          }
        >
          <div className={styles.action}>
            <Button label="Add product" onClick={openDrawer} />
          </div>
        </ContentState>
      )}

      {view === 'no-results' && (
        <ContentState
          title="No product found"
          text="Try a different name or brand"
        />
      )}

      {view === 'list' && (
        <div aria-busy={isPlaceholderData}>
          <ProductList products={products} onDetail={setSelectedProductId} />
          {isFetchNextPageError && (
            <Feedback
              status="error"
              title="We couldn’t load more products"
              description="Please try again."
              customClassName={styles.moreError}
            />
          )}
          {hasNextPage && (
            <div className={styles.more}>
              <Button
                label={isFetchingNextPage ? 'Loading…' : 'Load more'}
                variant="secondary"
                appearance="outline"
                // Not `disabled`: the button keeps the focus while it loads.
                aria-disabled={isFetchingNextPage}
                onClick={() => {
                  if (!isFetchingNextPage) {
                    void fetchNextPage();
                  }
                }}
              />
            </div>
          )}
        </div>
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
