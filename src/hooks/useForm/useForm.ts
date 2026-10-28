import { useState, type ChangeEvent } from 'react';

export interface FieldRule<Name extends string> {
  // Receives all the values so a field can depend on another one
  // (e.g. confirm password).
  validate: (value: string, values: Record<Name, string>) => boolean;
  // Message shown under the field; leave it out when the field has its own
  // way to explain the error (e.g. the password checklist).
  error?: string;
}

export interface FieldBinding {
  value: string;
  onChange: (event: ChangeEvent<HTMLInputElement>) => void;
  onBlur: () => void;
  // True only after the user has left the field: errors are not shown while
  // typing for the first time.
  hasError: boolean;
  error?: string;
}

export function useForm<Name extends string>(
  rules: Record<Name, FieldRule<Name>>,
) {
  const names = Object.keys(rules) as Name[];

  const [values, setValues] = useState(
    () =>
      Object.fromEntries(names.map((name) => [name, ''])) as Record<
        Name,
        string
      >,
  );
  const [touched, setTouched] = useState(
    () =>
      Object.fromEntries(names.map((name) => [name, false])) as Record<
        Name,
        boolean
      >,
  );

  const isFieldValid = (name: Name) =>
    rules[name].validate(values[name], values);
  const isValid = names.every(isFieldValid);

  const field = (name: Name): FieldBinding => {
    const hasError = touched[name] && !isFieldValid(name);
    return {
      value: values[name],
      onChange: (event) =>
        setValues((current) => ({ ...current, [name]: event.target.value })),
      onBlur: () => setTouched((current) => ({ ...current, [name]: true })),
      hasError,
      error: hasError ? rules[name].error : undefined,
    };
  };

  return { values, isValid, field };
}
