import { useCallback, useState } from 'react';
import PageHeader from '../../components/PageHeader/PageHeader';
import VisuallyHiddenStatus from '../../components/VisuallyHiddenStatus/VisuallyHiddenStatus';
import { useProducts } from '../../hooks/useProducts/useProducts';
import {
  getProductListAnnouncement,
  getProductListView,
} from '../../lib/productListView';
import AddProductDrawer from './components/AddProductDrawer/AddProductDrawer';
import ProductDetailDrawer from './components/ProductDetailDrawer/ProductDetailDrawer';
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
  // The id stays after the detail drawer closes, so its content does not
  // vanish while it slides out. A new key remounts it on every open, which asks
  // for the product again and gives the focus back to the Detail button on
  // close, as for the Add product drawer.
  const [selectedProductId, setSelectedProductId] = useState<string | null>(
    null,
  );
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const [detailKey, setDetailKey] = useState(0);

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

  // Stable, so the memoized product cards are not rendered again with the page.
  const openDetail = useCallback((productId: string) => {
    setSelectedProductId(productId);
    setDetailKey((key) => key + 1);
    setIsDetailOpen(true);
  }, []);

  const closeDetail = useCallback(() => setIsDetailOpen(false), []);
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
          onDetail={openDetail}
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
      <ProductDetailDrawer
        // Prefixed: both drawers count from 0, and sibling keys must differ.
        key={`detail-${detailKey}`}
        open={isDetailOpen}
        productId={selectedProductId}
        onClose={closeDetail}
      />
    </div>
  );
}

export default HomePage;
