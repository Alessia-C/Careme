import Button from '../../../../components/Button/Button';
import Feedback from '../../../../components/Feedback/Feedback';
import type { ProductListItem } from '../../../../lib/productsApi';
import ProductList from '../ProductList/ProductList';
import styles from './ProductListSection.module.css';

interface ProductListSectionProps {
  products: ProductListItem[];
  // True while the shown products are the previous search's, waiting for the
  // new ones.
  isBusy: boolean;
  hasNextPage: boolean;
  isFetchingNextPage: boolean;
  isFetchNextPageError: boolean;
  onDetail: (product: ProductListItem) => void;
  onDelete: (product: ProductListItem) => void;
  onLoadMore: () => void;
}

// The list with its "Load more" button and the error of a failed load.
const ProductListSection = ({
  products,
  isBusy,
  hasNextPage,
  isFetchingNextPage,
  isFetchNextPageError,
  onDetail,
  onDelete,
  onLoadMore,
}: ProductListSectionProps) => (
  <div aria-busy={isBusy}>
    <ProductList products={products} onDetail={onDetail} onDelete={onDelete} />
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
          size="large"
          fullWidth
          // Not `disabled`: the button keeps the focus while it loads.
          aria-disabled={isFetchingNextPage}
          onClick={onLoadMore}
        />
      </div>
    )}
  </div>
);

export default ProductListSection;
