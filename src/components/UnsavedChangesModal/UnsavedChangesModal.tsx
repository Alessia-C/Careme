import Modal from '../Modal/Modal';

interface UnsavedChangesModalProps {
  open: boolean;
  onDiscard: () => void;
  onContinue: () => void;
}

// Asks before leaving a form with changes that would be lost. Staying is the
// safe answer, so it is the main button, has the focus and is what Esc does.
const UnsavedChangesModal = ({
  open,
  onDiscard,
  onContinue,
}: UnsavedChangesModalProps) => (
  <Modal
    open={open}
    title="Unsaved changes"
    description="You have unsaved changes. Are you sure you want to leave? Your changes will be lost."
    confirmLabel="Continue editing"
    cancelLabel="Discard"
    onConfirm={onContinue}
    onCancel={onDiscard}
    focusConfirm
    onDismiss={onContinue}
  />
);

export default UnsavedChangesModal;
