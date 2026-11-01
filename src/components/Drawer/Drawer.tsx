import type { ReactNode } from 'react';
import Dialog from '../Dialog/Dialog';
import styles from './Drawer.module.css';

interface DrawerProps {
  open: boolean;
  title: string;
  onClose: () => void;
  children: ReactNode;
}

// Side panel built on Dialog: focus trap, Esc, backdrop click and the return
// of the focus come from the native <dialog>. The children fill the height
// under the title, so they can pin their own buttons to the bottom.
const Drawer = ({ open, title, onClose, children }: DrawerProps) => (
  <Dialog open={open} title={title} onClose={onClose} layout="side">
    <div className={styles.body}>{children}</div>
  </Dialog>
);

export default Drawer;
