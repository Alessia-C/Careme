import { useRef } from 'react';
import Button from '../../../../components/Button/Button';
import ContentState from '../../../../components/ContentState/ContentState';
import Drawer from '../../../../components/Drawer/Drawer';
import VisuallyHiddenStatus from '../../../../components/VisuallyHiddenStatus/VisuallyHiddenStatus';
import { useProduct } from '../../../../hooks/useProduct/useProduct';
import type { ProductListItem } from '../../../../lib/productsApi';
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

interface ProductDetailDrawerProps {
  open: boolean;
  // The product as the list shows it: its name and brand are the title and
  // the subtitle from the first moment, and what is loaded takes over.
  selected: ProductListItem | null;
  onClose: () => void;
}

// Read-only detail of one product. The page gives it a new key on every open,
// so the cached product is shown at once and asked again when it is stale.
const ProductDetailDrawer = ({
  open,
  selected,
  onClose,
}: ProductDetailDrawerProps) => {
  const { product, isPending, isError, isNotFound, refetch } = useProduct(
    selected?.id ?? null,
  );
  // A failed request wins over the cached product: if it was removed from
  // another tab, the drawer must not keep showing it.
  const loaded = isError ? undefined : product;
  // The loaded product is the newest, if its name or brand changed elsewhere.
  const shown = loaded ?? selected;
  const contentRef = useRef<HTMLDivElement>(null);

  // "Try again" is replaced by the loader as soon as the request starts, and
  // the focus would fall to the page. It goes to the content, which stays.
  const retry = () => {
    void refetch();
    contentRef.current?.focus();
  };

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
        <Button label="Try again" onClick={retry} size="large" fullWidth />
      </ContentState>
    );
  } else if (loaded) {
    content = (
      // A long note makes this area scroll. Safari does not let the keyboard
      // reach a scrolling area with nothing to focus in it, so it is a
      // focusable region, with a name for screen readers.
      <div
        className={styles.scroll}
        role="region"
        aria-label="Product details"
        tabIndex={0}
      >
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
      </div>
    );
  } else if (isPending) {
    content = <ContentState status="loading" title="Loading product…" />;
  }

  return (
    <Drawer
      open={open}
      title={shown?.name ?? ''}
      subtitle={shown?.brand}
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
      <div ref={contentRef} tabIndex={-1} className={styles.content}>
        {content}
      </div>
      {/* Always in the drawer, and only its text changes: the loader and the
          error say themselves what they are, but the product appears without
          a word to a screen reader. */}
      <VisuallyHiddenStatus>
        {loaded ? `${loaded.name}, ${loaded.brand}, loaded` : ''}
      </VisuallyHiddenStatus>
    </Drawer>
  );
};

export default ProductDetailDrawer;
