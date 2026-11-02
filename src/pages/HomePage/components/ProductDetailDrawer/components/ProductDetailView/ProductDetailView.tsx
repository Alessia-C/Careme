import type { ReactNode } from 'react';
import type { Product } from '../../../../../../lib/productsApi';
import type {
  Category,
  ProductStatus,
} from '../../../../../../../shared/products';
import styles from './ProductDetailView.module.css';

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

interface ProductDetailViewProps {
  product: Product;
  // A message under the details (e.g. the product was updated).
  feedback?: ReactNode;
}

const ProductDetailView = ({ product, feedback }: ProductDetailViewProps) => (
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
        <dd className={styles.value}>{CATEGORY_LABELS[product.category]}</dd>
      </div>
      <div className={styles.row}>
        <dt className={styles.label}>Status</dt>
        <dd className={styles.value}>{STATUS_LABELS[product.status]}</dd>
      </div>
      <div className={styles.row}>
        <dt className={styles.label}>Note</dt>
        <dd className={styles.value} data-empty={!product.note || undefined}>
          {product.note || 'No note'}
        </dd>
      </div>
    </dl>
    {feedback && <div className={styles.feedback}>{feedback}</div>}
  </div>
);

export default ProductDetailView;
