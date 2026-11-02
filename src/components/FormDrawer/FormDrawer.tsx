import type { ReactNode, SubmitEvent } from 'react';
import DrawerForm from '../DrawerForm/DrawerForm';
import Drawer from '../Drawer/Drawer';

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

// A drawer that is only a form: closing it is the same as Cancel. The caller
// only provides the fields and what happens on submit.
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
    <DrawerForm
      onSubmit={onSubmit}
      onCancel={onClose}
      submitLabel={submitLabel}
      isSubmitDisabled={isSubmitDisabled}
      feedback={feedback}
    >
      {children}
    </DrawerForm>
  </Drawer>
);

export default FormDrawer;
