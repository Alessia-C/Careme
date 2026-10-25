import styles from './Feedback.module.css';

export type FeedbackStatus = 'success' | 'error' | 'info';

interface FeedbackProps {
  title: string;
  description?: string;
  status: FeedbackStatus;
  customClassName?: string;
}

// Errors are announced right away (role="alert"); success and info are
// polite status updates that do not interrupt the screen reader.
const Feedback = ({
  title,
  description,
  status,
  customClassName,
}: FeedbackProps) => {
  const role = status === 'error' ? 'alert' : 'status';

  return (
    <div
      className={`${styles.feedback} ${customClassName || ''}`}
      data-status={status}
      role={role}
    >
      <p className={styles.title}>{title}</p>
      {description && <p className={styles.description}>{description}</p>}
    </div>
  );
};

export default Feedback;
