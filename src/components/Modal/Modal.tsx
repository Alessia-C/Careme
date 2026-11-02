import Button from '../Button/Button';
import Dialog from '../Dialog/Dialog';
import styles from './Modal.module.css';

type ConfirmVariant = 'primary' | 'error';

interface ModalProps {
  open: boolean;
  title: string;
  description: string;
  confirmLabel: string;
  cancelLabel?: string;
  variant?: ConfirmVariant;
  onConfirm: () => void;
  onCancel: () => void;
  // Esc: by default it is the same as Cancel, but a modal whose safe answer is
  // the confirm button (e.g. "Continue editing") sends it there.
  onDismiss?: () => void;
}

const Modal = ({
  open,
  title,
  description,
  confirmLabel,
  cancelLabel = 'Cancel',
  variant = 'primary',
  onConfirm,
  onCancel,
  onDismiss = onCancel,
}: ModalProps) => (
  <Dialog
    open={open}
    title={title}
    description={description}
    role="alertdialog"
    onClose={onDismiss}
    closeOnBackdropClick={false}
    className={styles.modal}
  >
    <div className={styles.actions}>
      <Button
        label={cancelLabel}
        variant="secondary"
        appearance="outline"
        onClick={onCancel}
      />
      <Button label={confirmLabel} variant={variant} onClick={onConfirm} />
    </div>
  </Dialog>
);

export default Modal;
