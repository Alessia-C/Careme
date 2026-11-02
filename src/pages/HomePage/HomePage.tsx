import { useState } from 'react';
import Button from '../../components/Button/Button';
import Feedback from '../../components/Feedback/Feedback';
import Loader from '../../components/Loader/Loader';
import plusIcon from '../../assets/icons/plus.svg';
import { useProducts } from '../../hooks/useProducts/useProducts';
import EmptyState from './components/EmptyState/EmptyState';
import AddProductDrawer from './components/AddProductDrawer/AddProductDrawer';
import ProductList from './components/ProductList/ProductList';
import ProductSearch from './components/ProductSearch/ProductSearch';
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

  const openDrawer = () => {
    setDrawerKey((key) => key + 1);
    setIsDrawerOpen(true);
  };

  // A failed "Load more" keeps the products already shown: only a failure of
  // the whole list replaces it.
  const hasListError = isError && !isFetchNextPageError;
  const isEmpty = !isPending && !hasListError && total === 0;
  // The previous list stays on screen while a new search loads
  // (isPlaceholderData), so an empty one is not yet the answer for this search.
  const isFirstAccess = isEmpty && search === '' && !isPlaceholderData;
  const isNoResults = isEmpty && !isFirstAccess;
  const hasProducts = !isPending && !hasListError && total > 0;
  // The header and the search come after the first load, and not on the first
  // access state, which has its own title and Add product button.
  const showHeader = !isPending && !isFirstAccess;

  return (
    <div className={styles.page}>
      <title>Careme</title>
      {showHeader ? (
        <div className={styles.header}>
          <h1 className={styles.pageTitle}>Your products</h1>
          <div className={styles.action}>
            <Button label="Add product" onClick={openDrawer} />
          </div>
        </div>
      ) : (
        <h1 className={styles.visuallyHidden}>Your products</h1>
      )}

      {showHeader && <ProductSearch onSearch={setSearch} />}

      {isPending && (
        <div className={styles.loading} role="status">
          <Loader />
          <p className={styles.loadingText}>Loading products…</p>
        </div>
      )}

      {hasListError && (
        <div className={styles.error}>
          <Feedback
            status="error"
            title="We couldn’t load your products"
            description="Please check your connection and try again."
          />
          <div className={styles.action}>
            <Button label="Try again" onClick={() => void refetch()} />
          </div>
        </div>
      )}

      {isFirstAccess && (
        <EmptyState
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
        </EmptyState>
      )}

      {isNoResults && (
        <EmptyState
          title="No product found"
          text="Start by adding your first product to manage your catalog"
        />
      )}

      {hasProducts && (
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
                disabled={isFetchingNextPage}
                onClick={() => void fetchNextPage()}
              />
            </div>
          )}
        </div>
      )}

      <AddProductDrawer
        key={drawerKey}
        open={isDrawerOpen}
        onClose={() => setIsDrawerOpen(false)}
      />
    </div>
  );
}

export default HomePage;
