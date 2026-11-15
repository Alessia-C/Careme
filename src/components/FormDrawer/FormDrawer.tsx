import { useState } from 'react';
import type { ReactNode, SubmitEvent } from 'react';
import { useUnsavedChangesGuard } from '../../hooks/useUnsavedChangesGuard/useUnsavedChangesGuard';
import Drawer from '../Drawer/Drawer';
import DrawerForm from '../DrawerForm/DrawerForm';
import UnsavedChangesModal from '../UnsavedChangesModal/UnsavedChangesModal';

interface FormDrawerProps {
  open: boolean;
  title: string;
  onClose: () => void;
  onSubmit: (event: SubmitEvent<HTMLFormElement>) => void;
  submitLabel: string;
  isSubmitDisabled: boolean;
  // A value differs from its initial one: leaving then asks the user first.
  isDirty: boolean;
  // While it is sent, leaving would hide the answer, so closing waits.
  isSubmitting?: boolean;
  // Messages (warnings, errors) shown under the fields.
  feedback?: ReactNode;
  // The fields.
  children: ReactNode;
}

// A drawer that is only a form: closing it is the same as Cancel. The caller
// only provides the fields and what happens on submit. With unsaved changes,
// every way of leaving (Cancel, X, Esc, backdrop, navigation) asks first.
const FormDrawer = ({
  open,
  title,
  onClose,
  onSubmit,
  submitLabel,
  isSubmitDisabled,
  isDirty,
  isSubmitting = false,
  feedback,
  children,
}: FormDrawerProps) => {
  const [isAsking, setIsAsking] = useState(false);
  // The drawer stays mounted when closed, so a form that is not on screen
  // must not hold the user back.
  const guard = useUnsavedChangesGuard(open && isDirty);

  const requestClose = () => {
    if (isSubmitting) return;
    if (isDirty) {
      setIsAsking(true);
    } else {
      onClose();
    }
  };

  const keepEditing = () => {
    if (guard.isBlocked) guard.stay();
    setIsAsking(false);
  };

  const discardChanges = () => {
    setIsAsking(false);
    if (guard.isBlocked) {
      guard.proceed();
      return;
    }
    onClose();
  };

  return (
    <>
      <Drawer open={open} title={title} onClose={requestClose}>
        <DrawerForm
          onSubmit={onSubmit}
          onCancel={requestClose}
          submitLabel={submitLabel}
          isSubmitDisabled={isSubmitDisabled}
          isSubmitting={isSubmitting}
          isCancelDisabled={isSubmitting}
          feedback={feedback}
        >
          {children}
        </DrawerForm>
      </Drawer>
      <UnsavedChangesModal
        open={isAsking || guard.isBlocked}
        onDiscard={discardChanges}
        onContinue={keepEditing}
      />
    </>
  );
};

export default FormDrawer;
