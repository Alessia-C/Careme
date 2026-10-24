// Shared with the frontend password checklist, so both sides enforce the same rules.
export const PASSWORD_MIN_LENGTH = 8;
export const PASSWORD_MAX_LENGTH = 20;
export const PASSWORD_UPPERCASE_REGEX = /[A-Z]/;
export const PASSWORD_LOWERCASE_REGEX = /[a-z]/;
export const PASSWORD_NUMBER_REGEX = /[0-9]/;
export const PASSWORD_SPECIAL_CHAR_REGEX = /[!@#$%^&*(),.?":{}|<>]/;

export const validatePassword = (password: string): boolean => {
  const isValidLength =
    password.length >= PASSWORD_MIN_LENGTH &&
    password.length <= PASSWORD_MAX_LENGTH;
  const hasUpperCase = PASSWORD_UPPERCASE_REGEX.test(password);
  const hasLowerCase = PASSWORD_LOWERCASE_REGEX.test(password);
  const hasNumber = PASSWORD_NUMBER_REGEX.test(password);
  const hasSpecialChar = PASSWORD_SPECIAL_CHAR_REGEX.test(password);

  const isValid =
    isValidLength &&
    hasUpperCase &&
    hasLowerCase &&
    hasNumber &&
    hasSpecialChar;
  return isValid;
};

export const validateInput = (input: string): boolean => {
  const isNonEmpty = input.trim().length > 0;
  return isNonEmpty;
};

export const normalizeEmail = (email: string): string =>
  email.trim().toLowerCase();

export const validateEmail = (email: string): boolean => {
  const normalizedEmail = normalizeEmail(email);
  if (!validateInput(normalizedEmail)) {
    return false;
  }

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(normalizedEmail);
};

export function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

export type Role = 'user' | 'admin';

// The DB check constraint is the source of truth, but the value read at
// runtime is still an untyped string: validate it before trusting the type.
export const isRole = (value: unknown): value is Role =>
  value === 'user' || value === 'admin';
