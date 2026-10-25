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
  // leave, so the local session is dropped anyway (shared devices).
  const { mutate, isPending } = useMutation({
    mutationFn: logout,
    onSettled: () => {
      endSession();
      broadcastLogout();
    },
  });

  return (
    <header className={styles.header}>
      <span role="img" aria-label="Careme" className={styles.logo} />
      <div className={styles.actions}>
        <Button
          label="Logout"
          variant="secondary"
          appearance="text"
          icon={<span aria-hidden="true" className={styles.icon} />}
          disabled={isPending}
          onClick={() => mutate()}
        />
      </div>
    </header>
  );
}

export default AppHeader;
