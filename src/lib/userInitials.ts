export interface UserNames {
  firstName: string;
  lastName: string;
  email: string;
}

// Takes the first character by code point, not by UTF-16 unit, so accented
// letters and CJK characters are not cut in half.
function firstCharacter(value: string): string {
  const [character] = Array.from(value.trim());
  return character ? character.toLocaleUpperCase() : '';
}

// Falls back to the first letter of the email when both names are empty.
export function getUserInitials({
  firstName,
  lastName,
  email,
}: UserNames): string {
  const initials = firstCharacter(firstName) + firstCharacter(lastName);
  return initials || firstCharacter(email);
}

// The accessible name of the badge: the full name, or the email when no name
// is set, so a screen reader never announces only the initials.
export function getUserFullName({
  firstName,
  lastName,
  email,
}: UserNames): string {
  const fullName = [firstName.trim(), lastName.trim()]
    .filter((part) => part !== '')
    .join(' ');
  return fullName || email;
}
