import type { ReactNode } from 'react';
import Dialog from '../Dialog/Dialog';
import styles from './Drawer.module.css';

interface DrawerProps {
  open: boolean;
  title: string;
  subtitle?: string;
  onClose: () => void;
  // Pinned under the children, which are the ones that scroll. Without it the
  // children can take the whole body, as a form does with its own buttons.
  footer?: ReactNode;
  // For a drawer with no Cancel button: see Dialog.
  showCloseOnMobile?: boolean;
  children: ReactNode;
}

// Side panel built on Dialog: focus trap, Esc, backdrop click and the return
// of the focus come from the native <dialog>. The children fill the height
// under the title, so they can pin their own buttons to the bottom.
const Drawer = ({
  open,
  title,
  subtitle,
  onClose,
  footer,
  showCloseOnMobile,
  children,
}: DrawerProps) => (
  <Dialog
    open={open}
    title={title}
    subtitle={subtitle}
    onClose={onClose}
    showCloseOnMobile={showCloseOnMobile}
    layout="side"
  >
    <div className={styles.body}>
      {children}
      {footer && <div className={styles.footer}>{footer}</div>}
    </div>
  </Dialog>
);

export default Drawer;
