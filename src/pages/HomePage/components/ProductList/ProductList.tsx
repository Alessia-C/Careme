import { memo } from 'react';
import type { ProductListItem } from '../../../../lib/productsApi';
import ProductCard from '../ProductCard/ProductCard';
import styles from './ProductList.module.css';

interface ProductListProps {
  products: ProductListItem[];
  onDetail: (product: ProductListItem) => void;
  onDelete: (product: ProductListItem) => void;
}

// Memoized: the page renders again for the drawer and the announcements, and
// the list does not change with them.
const ProductList = memo(
  ({ products, onDetail, onDelete }: ProductListProps) => (
    <ul className={styles.list} aria-label="Products">
      {products.map((product) => (
        <li key={product.id}>
          <ProductCard
            product={product}
            onDetail={onDetail}
            onDelete={onDelete}
          />
        </li>
      ))}
    </ul>
  ),
);

ProductList.displayName = 'ProductList';

export default ProductList;
