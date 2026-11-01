import { useId, type ReactNode } from 'react';
import styles from './EmptyState.module.css';

interface EmptyStateProps {
  title: string;
  text?: string;
  // Shown above the text.
  icon?: ReactNode;
  // Actions, shown below the text.
  children?: ReactNode;
}

const EmptyState = ({ title, text, icon, children }: EmptyStateProps) => {
  const titleId = useId();

  return (
    <section className={styles.emptyState} aria-labelledby={titleId}>
      {icon}
      <div className={styles.text}>
        <h2 id={titleId} className={styles.title}>
          {title}
        </h2>
        {text && <p className={styles.description}>{text}</p>}
      </div>
      {children}
    </section>
  );
};

export default EmptyState;
