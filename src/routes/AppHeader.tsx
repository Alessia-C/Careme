import Button from '../components/Button/Button';
import styles from './AppHeader.module.css';

// Logo and logout icon are CSS masks, so they take their color from the
// design tokens (logo) or from the text (icon) and not from the SVG files.
// role="img" + aria-label keep the logo readable as "Careme".
function AppHeader() {
  return (
    <header className={styles.header}>
      <span role="img" aria-label="Careme" className={styles.logo} />
      <div className={styles.actions}>
        <Button
          label="Logout"
          variant="secondary"
          appearance="text"
          icon={<span aria-hidden="true" className={styles.icon} />}
        />
      </div>
    </header>
  );
}

export default AppHeader;
