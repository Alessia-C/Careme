import type { ReactNode, SubmitEvent } from 'react';
import Button from '../Button/Button';
import styles from './DrawerForm.module.css';

interface DrawerFormProps {
  onSubmit: (event: SubmitEvent<HTMLFormElement>) => void;
  onCancel: () => void;
  submitLabel: string;
  isSubmitDisabled: boolean;
  // While the form is being sent, leaving it would hide the answer.
  isCancelDisabled?: boolean;
  // Messages (warnings, errors) shown under the fields.
  feedback?: ReactNode;
  // The fields.
  children: ReactNode;
}

// The form inside a drawer: the fields scroll on their own, the messages
// follow them, and the submit and Cancel buttons stay at the bottom.
const DrawerForm = ({
  onSubmit,
  onCancel,
  submitLabel,
  isSubmitDisabled,
  isCancelDisabled = false,
  feedback,
  children,
}: DrawerFormProps) => (
  <form className={styles.form} onSubmit={onSubmit} noValidate>
    <div className={styles.fields}>
      {children}
      {feedback}
    </div>
    <div className={styles.actions}>
      <Button type="submit" label={submitLabel} disabled={isSubmitDisabled} />
      <Button
        label="Cancel"
        variant="secondary"
        appearance="outline"
        disabled={isCancelDisabled}
        onClick={onCancel}
      />
    </div>
  </form>
);

export default DrawerForm;
