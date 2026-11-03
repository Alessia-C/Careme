import type { ReactNode } from 'react';
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
  // An error shown above the buttons, e.g. the confirmed action failed.
  feedback?: ReactNode;
  // True while the confirmed action runs: a second confirm click is ignored
  // and the modal cannot be cancelled.
  isConfirming?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
  // The confirm button gets the focus when it opens, instead of the first
  // button (Cancel): for a question where the safe answer is to confirm.
  focusConfirm?: boolean;
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
  feedback,
  isConfirming = false,
  onConfirm,
  onCancel,
  focusConfirm = false,
  onDismiss = onCancel,
}: ModalProps) => (
  <Dialog
    open={open}
    title={title}
    description={description}
    role="alertdialog"
    onClose={onDismiss}
    closeOnBackdropClick={false}
    preventClose={isConfirming}
    className={styles.modal}
  >
    {feedback}
    <div className={styles.actions}>
      <Button
        label={cancelLabel}
        variant="secondary"
        appearance="outline"
        disabled={isConfirming}
        onClick={onCancel}
      />
      <Button
        label={confirmLabel}
        variant={variant}
        // Not `disabled`: the button keeps the focus while the action runs.
        aria-disabled={isConfirming}
        data-autofocus={focusConfirm || undefined}
        onClick={onConfirm}
      />
    </div>
  </Dialog>
);

export default Modal;
