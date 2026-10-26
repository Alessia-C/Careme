import { useMutation } from '@tanstack/react-query';
import Button from '../components/Button/Button';
import { useEndSession } from '../hooks/useEndSession';
import { logout } from '../lib/authApi';
import { broadcastLogout } from '../lib/logoutChannel';
import styles from './AppHeader.module.css';

// Logo and logout icon are CSS masks, so they take their color from the
// design tokens (logo) or from the text (icon) and not from the SVG files.
// role="img" + aria-label keep the logo readable as "Careme".
function AppHeader() {
  const endSession = useEndSession();
  // onSettled, not onSuccess: even if the request failed the user asked to
  // leave, so the local session is dropped anyway (shared devices). The login
  // page is told whether the server confirmed it, because if not the HttpOnly
  // cookie (which scripts cannot delete) may still be in the browser.
  const { mutate, isPending } = useMutation({
    mutationFn: logout,
    onSettled: (result) => {
      const confirmed = result?.ok === true;
      endSession(confirmed);
      broadcastLogout(confirmed);
    },
  });

  return (
    <header className={styles.header}>
      <span role="img" aria-label="Careme" className={styles.logo} />
      {/* Always in the DOM: screen readers announce text changes of a live
          region that already exists, not one that appears with its text. */}
      <p role="status" className={styles.status}>
        {isPending ? 'Logging out…' : ''}
      </p>
      <div className={styles.actions}>
        <Button
          label="Logout"
          variant="secondary"
          appearance="text"
          icon={<span aria-hidden="true" className={styles.icon} />}
          // aria-disabled, not disabled: a disabled button that has focus
          // loses it, and keyboard and screen reader users would start over.
          aria-disabled={isPending}
          onClick={() => {
            if (!isPending) {
              mutate();
            }
          }}
        />
      </div>
    </header>
  );
}

export default AppHeader;
