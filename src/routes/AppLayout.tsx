import { Outlet } from 'react-router';
import { useLogoutSync } from '../hooks/useLogoutSync';
import AppHeader from './AppHeader';
import styles from './AppLayout.module.css';

// Shell for the protected routes. The skip link is the first focusable
// element, so keyboard users can jump straight to the page content.
function AppLayout() {
  useLogoutSync();

  return (
    <>
      <a href="#main" className={styles.skipLink}>
        Skip to content
      </a>
      <AppHeader />
      <main id="main" tabIndex={-1} className={styles.main}>
        <Outlet />
      </main>
    </>
  );
}

export default AppLayout;
