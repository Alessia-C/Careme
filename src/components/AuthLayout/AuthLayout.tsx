import type { ReactNode } from 'react';
import authPanel from '../../assets/images/auth-panel.jpg';
import styles from './AuthLayout.module.css';

interface AuthLayoutProps {
  children: ReactNode;
}

// Shared frame of the public auth pages (signup, login): the page content on
// the left, a decorative photo panel on the right. The panel is hidden on
// narrow screens.
const AuthLayout = ({ children }: AuthLayoutProps) => (
  <main className={styles.page}>
    <div className={styles.formPanel}>{children}</div>
    <aside className={styles.imagePanel}>
      <img src={authPanel} alt="" className={styles.image} />
      <div className={styles.caption}>
        <p className={styles.captionTitle}>LUXURY BEAUTY</p>
        <p className={styles.captionText}>
          Curated essentials for a modern routine.
        </p>
      </div>
    </aside>
  </main>
);

export default AuthLayout;
