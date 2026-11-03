import { useCallback, useEffect, useRef, useState } from 'react';
import Feedback from '../../components/Feedback/Feedback';
import PageHeader from '../../components/PageHeader/PageHeader';
import VisuallyHiddenStatus from '../../components/VisuallyHiddenStatus/VisuallyHiddenStatus';
import { useProducts } from '../../hooks/useProducts/useProducts';
import type { ProductListItem } from '../../lib/productsApi';
import {
  getProductListAnnouncement,
  getProductListView,
} from '../../lib/productListView';
import AddProductDrawer from './components/AddProductDrawer/AddProductDrawer';
import DeleteProductModal from './components/DeleteProductModal/DeleteProductModal';
import ProductDetailDrawer from './components/ProductDetailDrawer/ProductDetailDrawer';
import ProductListSection from './components/ProductListSection/ProductListSection';
import ProductSearch from './components/ProductSearch/ProductSearch';
import ProductsEmptyState from './components/ProductsEmptyState/ProductsEmptyState';
import styles from './HomePage.module.css';

// Long enough to read the message, short enough not to stay on the page.
const DELETE_NOTICE_MS = 5000;

function HomePage() {
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  // A new key remounts the drawer, so the form starts empty every time it
  // opens. The drawer is not remounted on close: the native dialog gives the
  // focus back to this button.
  const [drawerKey, setDrawerKey] = useState(0);
  const [search, setSearch] = useState('');
  // The product stays after the detail drawer closes, so its content does not
  // vanish while it slides out. It is the one of the list: its name and brand
  // are the title while the rest loads. A new key remounts the drawer on every
  // open, which gives the focus back to the Detail button on close, as for the
  // Add product drawer.
  const [selectedProduct, setSelectedProduct] =
    useState<ProductListItem | null>(null);
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const [detailKey, setDetailKey] = useState(0);
  // Asked to confirm: the modal is open while there is one. It opens over the
  // detail drawer too, which stays below until the product is deleted.
  const [productToDelete, setProductToDelete] =
    useState<ProductListItem | null>(null);
  // A new object on every deletion, so the message restarts its timer.
  const [deleteNotice, setDeleteNotice] = useState<object | null>(null);
  // The card or the drawer that had the focus is gone after a deletion: the
  // focus goes to the page, counted so that a second deletion moves it again.
  const [focusPageCount, setFocusPageCount] = useState(0);
  const pageRef = useRef<HTMLDivElement>(null);

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
  const openDetail = useCallback((product: ProductListItem) => {
    setSelectedProduct(product);
    setDetailKey((key) => key + 1);
    setIsDetailOpen(true);
  }, []);

  const closeDetail = useCallback(() => setIsDetailOpen(false), []);

  // Stable, so the memoized product cards are not rendered again with the page.
  const requestDelete = useCallback(
    (product: ProductListItem) => setProductToDelete(product),
    [],
  );
  const cancelDelete = useCallback(() => setProductToDelete(null), []);
  const handleDeleted = useCallback(() => {
    setProductToDelete(null);
    // The product is gone: the drawer closes and stops asking for it.
    setIsDetailOpen(false);
    setSelectedProduct(null);
    setDeleteNotice({});
    setFocusPageCount((count) => count + 1);
  }, []);

  useEffect(() => {
    if (deleteNotice === null) {
      return;
    }
    const timer = setTimeout(() => setDeleteNotice(null), DELETE_NOTICE_MS);
    return () => clearTimeout(timer);
  }, [deleteNotice]);

  // After the dialogs, whose effects run first and give the focus back to the
  // button that opened them.
  useEffect(() => {
    if (focusPageCount > 0) {
      pageRef.current?.focus();
    }
  }, [focusPageCount]);
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
    <div ref={pageRef} tabIndex={-1} className={styles.page}>
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
          onDelete={requestDelete}
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
        selected={selectedProduct}
        onClose={closeDetail}
        onDelete={requestDelete}
      />
      <DeleteProductModal
        product={productToDelete}
        onCancel={cancelDelete}
        onDeleted={handleDeleted}
      />

      {/* Always in the page, and only its content changes, like the status
          above: a live region that appears already filled is not announced by
          many screen readers. */}
      <div className={styles.notice} aria-live="polite">
        {deleteNotice && (
          <Feedback status="success" title="Product deleted successfully" />
        )}
      </div>
    </div>
  );
}

export default HomePage;
