import styles from './Loader.module.css';

// Decorative spinner (Figma "Loader", size Giant), drawn with CSS only: the
// caller announces the loading state, for example with a role="status" text.
function Loader() {
  return (
    <span className={styles.loader} aria-hidden="true">
      <span className={styles.ring} />
    </span>
  );
}

export default Loader;
