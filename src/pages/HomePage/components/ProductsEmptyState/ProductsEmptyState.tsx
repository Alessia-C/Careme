import { memo } from 'react';
import Button from '../../../../components/Button/Button';
import ContentState, {
  type ContentStateProps,
} from '../../../../components/ContentState/ContentState';
import plusIcon from '../../../../assets/icons/plus.svg';
import styles from './ProductsEmptyState.module.css';

export type EmptyView = 'loading' | 'error' | 'first-access' | 'no-results';

interface ProductsEmptyStateProps {
  view: EmptyView;
  onRetry: () => void;
  onAdd: () => void;
}

interface State extends Omit<ContentStateProps, 'children'> {
  action?: { label: string; onClick: () => void };
}

// Built once, not on every render.
const PLUS_ICON = (
  <div className={styles.icon}>
    <img src={plusIcon} alt="" width={32} height={32} />
  </div>
);

// What the page shows instead of the list: one state per case in which there
// are no products to list. Memoized: the page renders again for the drawer and
// the announcements, and these states do not change with them.
const ProductsEmptyState = memo(
  ({ view, onRetry, onAdd }: ProductsEmptyStateProps) => {
    const states: Record<EmptyView, State> = {
      loading: { status: 'loading', title: 'Loading products…' },
      error: {
        status: 'error',
        title: 'We couldn’t load your products',
        text: 'Please check your connection and try again.',
        action: { label: 'Try again', onClick: onRetry },
      },
      'first-access': {
        title: 'Add your product',
        text: 'Start by adding your first product to manage your catalog',
        icon: PLUS_ICON,
        action: { label: 'Add product', onClick: onAdd },
      },
      'no-results': {
        title: 'No product found',
        text: 'Try a different name or brand',
      },
    };
    const { action, ...content } = states[view];

    return (
      <ContentState {...content}>
        {action && (
          <div className={styles.action}>
            <Button label={action.label} onClick={action.onClick} />
          </div>
        )}
      </ContentState>
    );
  },
);

ProductsEmptyState.displayName = 'ProductsEmptyState';

export default ProductsEmptyState;
