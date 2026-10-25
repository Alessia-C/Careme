import styles from './Feedback.module.css';

export type FeedbackStatus = 'success' | 'error' | 'info';

interface FeedbackProps {
  title: string;
  description: string;
  status: FeedbackStatus;
}

// Errors are announced right away (role="alert"); success and info are
// polite status updates that do not interrupt the screen reader.
const Feedback = ({ title, description, status }: FeedbackProps) => {
  const role = status === 'error' ? 'alert' : 'status';

  return (
    <div className={styles.feedback} data-status={status} role={role}>
      <p className={styles.title}>{title}</p>
      <p className={styles.description}>{description}</p>
    </div>
  );
};

export default Feedback;
