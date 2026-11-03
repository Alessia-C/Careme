import { useId, type ReactNode } from 'react';
import Feedback from '../Feedback/Feedback';
import Loader from '../Loader/Loader';
import styles from './ContentState.module.css';

export type ContentStatus = 'default' | 'error' | 'loading';

export interface ContentStateProps {
  title: string;
  // 'default' covers the empty and "nothing found" cases, which differ only in
  // the content the caller passes.
  status?: ContentStatus;
  text?: string;
  // Shown above the text. Not used while loading or on error.
  icon?: ReactNode;
  // Actions, shown below the text.
  children?: ReactNode;
}

// The content area of a page that has nothing to list: it explains why (first
// access, no results), reports a failure or shows that the content is loading.
const ContentState = ({
  title,
  status = 'default',
  text,
  icon,
  children,
}: ContentStateProps) => {
  const titleId = useId();

  if (status === 'loading') {
    return (
      <div className={styles.contentState} aria-busy="true">
        <Loader />
        <p role="status" className={styles.loadingText}>
          {title}
        </p>
      </div>
    );
  }

  if (status === 'error') {
    return (
      <div className={styles.error}>
        <Feedback status="error" title={title} description={text} />
        {children}
      </div>
    );
  }

  return (
    <section className={styles.contentState} aria-labelledby={titleId}>
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

export default ContentState;
