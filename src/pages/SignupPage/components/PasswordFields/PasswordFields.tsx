import { useState } from 'react';
import PasswordInput from '../../../../components/PasswordInput/PasswordInput';
import type { FieldBinding } from '../../../../hooks/useForm/useForm';

interface PasswordFieldsProps {
  password: FieldBinding;
  confirmPassword: FieldBinding;
}

const PasswordFields = ({ password, confirmPassword }: PasswordFieldsProps) => {
  const [isPasswordFocused, setIsPasswordFocused] = useState(false);
  const [isConfirmFocused, setIsConfirmFocused] = useState(false);

  return (
    <>
      <PasswordInput
        label="Password*"
        placeholder="Create a password"
        autoComplete="new-password"
        value={password.value}
        onChange={password.onChange}
        onFocus={() => setIsPasswordFocused(true)}
        onBlur={() => {
          setIsPasswordFocused(false);
          password.onBlur();
        }}
        required
        // The checklist is visible only while the field has focus; after
        // blur only the error status remains.
        requirements={isPasswordFocused ? undefined : []}
        status={password.hasError ? 'error' : 'default'}
      />
      <PasswordInput
        label="Confirm Password*"
        placeholder="Confirm your password"
        autoComplete="new-password"
        value={confirmPassword.value}
        onChange={confirmPassword.onChange}
        onFocus={() => setIsConfirmFocused(true)}
        onBlur={() => {
          setIsConfirmFocused(false);
          confirmPassword.onBlur();
        }}
        required
        // Reuses the checklist as the only message for this field, shown
        // only while focused.
        requirements={
          isConfirmFocused
            ? [
                {
                  label: 'Passwords match',
                  isMet: (confirm) =>
                    confirm.length > 0 && confirm === password.value,
                },
              ]
            : []
        }
        status={confirmPassword.hasError ? 'error' : 'default'}
      />
    </>
  );
};

export default PasswordFields;
