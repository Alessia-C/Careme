import {
  getUserFullName,
  getUserInitials,
  type UserNames,
} from '../../../../lib/userInitials';
import styles from './UserBadge.module.css';

// Not interactive: a plain round badge with the user's initials. The initials
// are hidden from assistive tech, which reads the full name from aria-label
// instead of spelling out the letters one by one.
function UserBadge({ firstName, lastName, email }: UserNames) {
  const names = { firstName, lastName, email };
  return (
    <span
      role="img"
      aria-label={getUserFullName(names)}
      className={styles.badge}
    >
      <span aria-hidden="true">{getUserInitials(names)}</span>
    </span>
  );
}

export default UserBadge;
