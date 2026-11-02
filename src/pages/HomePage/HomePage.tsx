import { useCallback, useState } from 'react';
import PageHeader from '../../components/PageHeader/PageHeader';
import VisuallyHiddenStatus from '../../components/VisuallyHiddenStatus/VisuallyHiddenStatus';
import { useProducts } from '../../hooks/useProducts/useProducts';
import {
  getProductListAnnouncement,
  getProductListView,
} from '../../lib/productListView';
import AddProductDrawer from './components/AddProductDrawer/AddProductDrawer';
import ProductListSection from './components/ProductListSection/ProductListSection';
import ProductSearch from './components/ProductSearch/ProductSearch';
import ProductsEmptyState from './components/ProductsEmptyState/ProductsEmptyState';
import styles from './HomePage.module.css';

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

  const view = getProductListView({
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
      <title>Your products – Careme</title>
      {showHeader && (
        <>
          <PageHeader
            title="Your products"
            actionLabel="Add product"
            onAction={openDrawer}
          />
          <ProductSearch disabled onSearch={setSearch} />
        </>
      )}

      {/* Always in the page, and only its text changes: a live region that
          appears already filled is not announced by many screen readers. */}
      <VisuallyHiddenStatus>
        {getProductListAnnouncement({
          view,
          shown: products.length,
          total,
          isPlaceholderData,
        })}
      </VisuallyHiddenStatus>

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
