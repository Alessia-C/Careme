import Button from '../../../../components/Button/Button';
import ContentState from '../../../../components/ContentState/ContentState';
import Drawer from '../../../../components/Drawer/Drawer';
import { useProduct } from '../../../../hooks/useProduct/useProduct';
import type { Category, ProductStatus } from '../../../../../shared/products';
import styles from './ProductDetailDrawer.module.css';

// Also in ProductCard: extract them when a third place needs them.
const CATEGORY_LABELS: Record<Category, string> = {
  skincare: 'Skincare',
  makeup: 'Makeup',
};

const STATUS_LABELS: Record<ProductStatus, string> = {
  new: 'New',
  used: 'Used',
  finished: 'Finished',
};

// The name is the title once the product is loaded: until then the drawer
// still needs a name for screen readers.
const FALLBACK_TITLE = 'Product detail';

interface ProductDetailDrawerProps {
  open: boolean;
  productId: string | null;
  onClose: () => void;
}

// Read-only detail of one product. The page gives it a new key on every open,
// so it asks for the product again each time and shows the cached one meanwhile.
const ProductDetailDrawer = ({
  open,
  productId,
  onClose,
}: ProductDetailDrawerProps) => {
  const { product, isPending, isError, isNotFound, refetch } =
    useProduct(productId);
  // A failed request wins over the cached product: if it was removed from
  // another tab, the drawer must not keep showing it.
  const loaded = isError ? undefined : product;

  let content;
  if (isError) {
    content = isNotFound ? (
      <ContentState
        status="error"
        title="Product not found"
        text="It may no longer be available."
      />
    ) : (
      <ContentState
        status="error"
        title="We couldn’t load the product"
        text="Please check your connection and try again."
      >
        <Button
          label="Try again"
          onClick={() => void refetch()}
          size="large"
          fullWidth
        />
      </ContentState>
    );
  } else if (loaded) {
    content = (
      <dl className={styles.details}>
        <div className={styles.row}>
          <dt className={styles.label}>Category</dt>
          <dd className={styles.value}>{CATEGORY_LABELS[loaded.category]}</dd>
        </div>
        <div className={styles.row}>
          <dt className={styles.label}>Status</dt>
          <dd className={styles.value}>{STATUS_LABELS[loaded.status]}</dd>
        </div>
        <div className={styles.row}>
          <dt className={styles.label}>Note</dt>
          <dd className={styles.value} data-empty={!loaded.note || undefined}>
            {loaded.note || 'No note'}
          </dd>
        </div>
      </dl>
    );
  } else if (isPending) {
    content = <ContentState status="loading" title="Loading product…" />;
  }

  return (
    <Drawer
      open={open}
      title={loaded ? loaded.name : FALLBACK_TITLE}
      subtitle={loaded?.brand}
      onClose={onClose}
      // No Cancel button here: on a phone the X is the only way to close it.
      showCloseOnMobile
      footer={
        loaded && (
          <div className={styles.actions}>
            {/* Only the CTAs of the design, disabled until updating and
                deleting a product have their own issue: an enabled button
                that does nothing would mislead. */}
            <Button label="Update" disabled />
            <Button
              label="Delete"
              variant="error"
              appearance="outline"
              disabled
            />
          </div>
        )
      }
    >
      {content}
    </Drawer>
  );
};

export default ProductDetailDrawer;
