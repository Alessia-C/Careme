import type { ReactNode } from 'react';
import styles from './VisuallyHiddenStatus.module.css';

interface VisuallyHiddenStatusProps {
  children?: ReactNode;
}

// A live region read out by screen readers and not shown. Keep it in the page
// and change only its text: many screen readers do not announce a region that
// appears already filled.
const VisuallyHiddenStatus = ({ children }: VisuallyHiddenStatusProps) => (
  <p role="status" className={styles.status}>
    {children}
  </p>
);

export default VisuallyHiddenStatus;
