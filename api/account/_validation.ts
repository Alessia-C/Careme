import {
  PROFILE_NAME_MAX_LENGTH,
  profileNameError,
  readText,
} from '../../shared/validation.js';

export type AccountInput = {
  first_name: string;
  last_name: string;
};

export type ParsedAccount =
  { ok: true; value: AccountInput } | { ok: false; message: string };

const ALLOWED_FIELDS = ['first_name', 'last_name'];

const invalid = (message: string): ParsedAccount => ({ ok: false, message });

// Validates the body and returns the values to save (trimmed). Unlike products,
// an unknown field is refused instead of ignored: a caller sending email, role
// or status must not believe that it was saved.
export function parseAccountInput(
  body: Record<string, unknown>,
): ParsedAccount {
  const hasUnknownField = Object.keys(body).some(
    (field) => !ALLOWED_FIELDS.includes(field),
  );
  if (hasUnknownField) {
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
