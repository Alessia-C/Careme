export const validatePassword = (password: string): boolean => {
  const isValidLength = password.length >= 8 && password.length <= 20;
  const hasUpperCase = /[A-Z]/.test(password);
  const hasLowerCase = /[a-z]/.test(password);
  const hasNumber = /[0-9]/.test(password);
  const hasSpecialChar = /[!@#$%^&*(),.?":{}|<>]/.test(password);

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

export const validateEmail = (email: string): boolean => {
  const normalizedEmail = email.trim().toLowerCase();
  if (!validateInput(normalizedEmail)) {
    return false;
  }

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(normalizedEmail);
};
