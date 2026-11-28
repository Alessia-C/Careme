import {
  PASSWORD_POLICY_MESSAGE,
  PROFILE_NAME_MAX_LENGTH,
  SAME_PASSWORD_MESSAGE,
  profileNameError,
  readText,
  validatePassword,
} from '../../shared/validation.js';
import { invalid, type Parsed } from '../_lib/validation.js';

export type AccountInput = {
  first_name: string;
  last_name: string;
};

export type PasswordInput = {
  current_password: string;
  new_password: string;
};

const ALLOWED_FIELDS = ['first_name', 'last_name'];
const PASSWORD_FIELDS = [
  'current_password',
  'new_password',
  'confirm_password',
];

function hasFieldOutside(
  body: Record<string, unknown>,
  allowed: string[],
): boolean {
  return Object.keys(body).some((field) => !allowed.includes(field));
}

// Validates the body and returns the values to save (trimmed). Unlike products,
// an unknown field is refused instead of ignored: a caller sending email, role
// or status must not believe that it was saved.
export function parseAccountInput(
  body: Record<string, unknown>,
): Parsed<AccountInput> {
  if (hasFieldOutside(body, ALLOWED_FIELDS)) {
    return invalid('Only first_name and last_name can be updated');
  }

  const firstName = readText(body.first_name, PROFILE_NAME_MAX_LENGTH);
  if (firstName === undefined) {
    return invalid(profileNameError('First name'));
  }
  const lastName = readText(body.last_name, PROFILE_NAME_MAX_LENGTH);
  if (lastName === undefined) {
    return invalid(profileNameError('Last name'));
  }

  return { ok: true, value: { first_name: firstName, last_name: lastName } };
}

// Passwords are never trimmed: spaces are part of them. The current one is not
// held to the policy, because it may be older than the policy itself.
export function parsePasswordInput(
  body: Record<string, unknown>,
): Parsed<PasswordInput> {
  if (hasFieldOutside(body, PASSWORD_FIELDS)) {
    return invalid(
      'Only current_password, new_password and confirm_password are accepted',
    );
  }

  const { current_password, new_password, confirm_password } = body;
  if (typeof current_password !== 'string' || current_password === '') {
    return invalid('Current password is required');
  }
  if (typeof new_password !== 'string' || !validatePassword(new_password)) {
    return invalid(PASSWORD_POLICY_MESSAGE);
  }
  if (confirm_password !== new_password) {
    return invalid('Password confirmation does not match');
  }
  if (new_password === current_password) {
    return invalid(SAME_PASSWORD_MESSAGE);
  }

  return { ok: true, value: { current_password, new_password } };
}
