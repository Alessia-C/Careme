import styles from './Feedback.module.css';

export type FeedbackStatus = 'success' | 'error' | 'info';

interface FeedbackProps {
  title: string;
  description?: string;
  status: FeedbackStatus;
  customClassName?: string;
  id?: string;
  onClose?: () => void;
}

// Errors are announced right away (role="alert"); success and info are
// polite status updates that do not interrupt the screen reader.
const Feedback = ({
  title,
  description,
  status,
  customClassName,
  id,
  onClose,
}: FeedbackProps) => {
  const role = status === 'error' ? 'alert' : 'status';

  return (
    <div
      className={`${styles.feedback} ${customClassName || ''}`}
      data-status={status}
      role={role}
      id={id}
    >
      <div className={styles.content}>
        <p className={styles.title}>{title}</p>
        {description && <p className={styles.description}>{description}</p>}
      </div>
      {onClose && (
        <button
          type="button"
          aria-label="Close message"
          className={styles.close}
          onClick={onClose}
        >
          <span aria-hidden="true" className={styles.closeIcon} />
        </button>
      )}
    </div>
  );
};

export default Feedback;
