import { useId } from 'react';
import Button from '../../../../components/Button/Button';
import type { ProductListItem } from '../../../../lib/productsApi';
import type { Category, ProductStatus } from '../../../../../shared/products';
import styles from './ProductCard.module.css';

const CATEGORY_LABELS: Record<Category, string> = {
  skincare: 'Skincare',
  makeup: 'Makeup',
};

const STATUS_LABELS: Record<ProductStatus, string> = {
  new: 'New',
  used: 'Used',
  finished: 'Finished',
};

interface ProductCardProps {
  product: ProductListItem;
  onDetail: (productId: string) => void;
}

const ProductCard = ({ product, onDetail }: ProductCardProps) => {
  const titleId = useId();

  return (
    <article className={styles.card} aria-labelledby={titleId}>
      <div className={styles.summary}>
        <div className={styles.header}>
          <div className={styles.heading}>
            <h2 id={titleId} className={styles.name}>
              {product.name}
            </h2>
            <p className={styles.category}>
              {CATEGORY_LABELS[product.category]}
            </p>
          </div>
          <span className={styles.badge} data-status={product.status}>
            {STATUS_LABELS[product.status]}
          </span>
        </div>
        <hr className={styles.divider} />
        <dl className={styles.brand}>
          <dt className={styles.brandLabel}>Brand</dt>
          <dd className={styles.brandValue}>{product.brand}</dd>
        </dl>
      </div>
      <div className={styles.actions}>
        <Button
          label="Detail"
          aria-label={`Detail ${product.name}`}
          onClick={() => onDetail(product.id)}
        />
        {/* Only the CTA of the design: deleting a product is a later issue. */}
        <Button
          label="Delete"
          aria-label={`Delete ${product.name}`}
          variant="secondary"
          appearance="outline"
        />
      </div>
    </article>
  );
};

export default ProductCard;
