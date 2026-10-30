import { useEffect, useId, useRef } from 'react';
import type { MouseEvent, ReactNode } from 'react';
import styles from './Dialog.module.css';

interface DialogProps {
  open: boolean;
  title: string;
  description?: string;
  role?: 'dialog' | 'alertdialog';
  onClose: () => void;
  children: ReactNode;
  className?: string;
  closeOnBackdropClick?: boolean;
}

const Dialog = ({
  open,
  title,
  description,
  role = 'dialog',
  onClose,
  children,
  className,
  closeOnBackdropClick = true,
}: DialogProps) => {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const descriptionId = useId();
  // The native 'close' event also fires when we call dialog.close() ourselves.
  // This flag tells handleClose to ignore that event, so onClose only reports
  // closes the user caused (Esc or backdrop click).
  const closingFromProp = useRef(false);

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;

    if (open && !dialog.open) {
      dialog.showModal();
    } else if (!open && dialog.open) {
      closingFromProp.current = true;
      dialog.close();
    }
  }, [open]);

  const handleClose = () => {
    if (closingFromProp.current) {
      closingFromProp.current = false;
      return;
    }
    onClose();
  };

  // The content sits in an inner div with its own padding, so a click
  // whose target is the <dialog> itself can only come from the backdrop.
  const handleClick = (event: MouseEvent<HTMLDialogElement>) => {
    if (closeOnBackdropClick && event.target === event.currentTarget) {
      onClose();
    }
  };

  return (
    <dialog
      ref={ref}
      role={role}
      aria-labelledby={titleId}
      aria-describedby={description ? descriptionId : undefined}
      onClose={handleClose}
      onClick={handleClick}
      className={[styles.dialog, className].filter(Boolean).join(' ')}
    >
      <div className={styles.content}>
        <h2 id={titleId} className={styles.title}>
          {title}
        </h2>
        {description && (
          <p id={descriptionId} className={styles.description}>
            {description}
          </p>
        )}
        {children}
      </div>
    </dialog>
  );
};

export default Dialog;
