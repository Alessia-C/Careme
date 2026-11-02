import type { ProductListItem } from '../../../../lib/productsApi';
import ProductCard from '../ProductCard/ProductCard';
import styles from './ProductList.module.css';

interface ProductListProps {
  products: ProductListItem[];
  onDetail: (productId: string) => void;
}

const ProductList = ({ products, onDetail }: ProductListProps) => (
  <ul className={styles.list} aria-label="Products">
    {products.map((product) => (
      <li key={product.id}>
        <ProductCard product={product} onDetail={onDetail} />
      </li>
    ))}
  </ul>
);

export default ProductList;
