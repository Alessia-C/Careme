import type { ReactNode } from 'react';
import logo from '../../assets/icons/logo.svg';
import authPanel from '../../assets/images/auth-panel.jpg';
import styles from './AuthLayout.module.css';

interface AuthLayoutProps {
  children?: ReactNode;
  info?: {
    title: string;
    description: string;
    heading: string;
  };
}

// Shared frame of the public auth pages
const AuthLayout = ({ info, children }: AuthLayoutProps) => (
  <main className={styles.page}>
    <title>{info?.title}</title>
    <div className={styles.formPanel}>
      <div className={styles.brand}>
        <img src={logo} alt="Careme" className={styles.logo} />
        <h1 className={styles.heading}>{info?.heading}</h1>
        <p className={styles.description}>{info?.description}</p>
      </div>
      {children}
    </div>
    <aside className={styles.imagePanel}>
      <img src={authPanel} alt="" className={styles.image} />
    </aside>
  </main>
);

export default AuthLayout;
