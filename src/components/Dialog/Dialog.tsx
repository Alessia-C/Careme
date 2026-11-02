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
  // 'side' is the layout of the Drawer: the title sits on the left of a header
  // with its own close button, and the box is a panel on the right.
  layout?: 'center' | 'side';
  // Under the title, in the 'side' layout only. It also describes the dialog,
  // before the description if there is one.
  subtitle?: string;
  // Phones hide the close button of a side panel, because a form has its own
  // Cancel. A panel without one asks to keep it.
  showCloseOnMobile?: boolean;
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
  layout = 'center',
  subtitle,
  showCloseOnMobile = false,
}: DialogProps) => {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const descriptionId = useId();
  const subtitleId = useId();
  const sideSubtitle = layout === 'side' ? subtitle : undefined;
  // In the order they appear on screen: the subtitle is in the header, above
  // the description.
  const describedBy =
    [sideSubtitle && subtitleId, description && descriptionId]
      .filter(Boolean)
      .join(' ') || undefined;
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

  const heading = (
    <h2 id={titleId} className={styles.title}>
      {title}
    </h2>
  );

  return (
    <dialog
      ref={ref}
      role={role}
      aria-labelledby={titleId}
      aria-describedby={describedBy}
      onClose={handleClose}
      onClick={handleClick}
      className={[styles.dialog, layout === 'side' && styles.side, className]
        .filter(Boolean)
        .join(' ')}
    >
      <div className={styles.content}>
        {layout === 'side' ? (
          <div
            className={[styles.header, sideSubtitle && styles.headerTop]
              .filter(Boolean)
              .join(' ')}
          >
            <div className={styles.headings}>
              {heading}
              {sideSubtitle && (
                <p id={subtitleId} className={styles.subtitle}>
                  {sideSubtitle}
                </p>
              )}
            </div>
            <button
              type="button"
              aria-label="Close"
              className={[
                styles.close,
                showCloseOnMobile && styles.closeOnMobile,
              ]
                .filter(Boolean)
                .join(' ')}
              onClick={onClose}
            >
              <span aria-hidden="true" className={styles.closeIcon} />
            </button>
          </div>
        ) : (
          heading
        )}
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
