import type { ReactNode, SubmitEvent } from 'react';
import Button from '../Button/Button';
import Drawer from '../Drawer/Drawer';
import styles from './FormDrawer.module.css';

interface FormDrawerProps {
  open: boolean;
  title: string;
  onClose: () => void;
  onSubmit: (event: SubmitEvent<HTMLFormElement>) => void;
  submitLabel: string;
  isSubmitDisabled: boolean;
  // Messages (warnings, errors) shown under the fields.
  feedback?: ReactNode;
  // The fields.
  children: ReactNode;
}

// The structure every form drawer shares: the fields scroll on their own,
// the messages follow them, and the submit and Cancel buttons stay at the
// bottom. The caller only provides the fields and what happens on submit.
const FormDrawer = ({
  open,
  title,
  onClose,
  onSubmit,
  submitLabel,
  isSubmitDisabled,
  feedback,
  children,
}: FormDrawerProps) => (
  <Drawer open={open} title={title} onClose={onClose}>
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
          onClick={onClose}
        />
      </div>
    </form>
  </Drawer>
);

export default FormDrawer;
