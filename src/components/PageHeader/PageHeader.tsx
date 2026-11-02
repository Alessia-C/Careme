import Button from '../Button/Button';
import styles from './PageHeader.module.css';

interface PageHeaderProps {
  title: string;
  actionLabel: string;
  onAction: () => void;
}

// The page title (the page's h1) with its main action on the right.
const PageHeader = ({ title, actionLabel, onAction }: PageHeaderProps) => (
  <div className={styles.header}>
    <h1 className={styles.title}>{title}</h1>
    <div className={styles.action}>
      <Button label={actionLabel} onClick={onAction} />
    </div>
  </div>
);

export default PageHeader;
