import { useState, type ChangeEvent } from 'react';

export interface FieldRule<Name extends string> {
  // Receives all the values so a field can depend on another one
  // (e.g. confirm password).
  validate: (value: string, values: Record<Name, string>) => boolean;
  // Message shown under the field; leave it out when the field has its own
  // way to explain the error (e.g. the password checklist).
  error?: string;
}

// Every native control that holds a text value, so a field can be bound to an
// input, a select or a textarea.
type FieldElement = HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement;

export interface FieldBinding {
  value: string;
  onChange: (event: ChangeEvent<FieldElement>) => void;
  onBlur: () => void;
  // True only after the user has left the field: errors are not shown while
  // typing for the first time.
  hasError: boolean;
  error?: string;
}

export function useForm<Name extends string>(
  rules: Record<Name, FieldRule<Name>>,
  // Fields that start with a value other than '' (e.g. a select default).
  initialValues: Partial<Record<Name, string>> = {},
) {
  const names = Object.keys(rules) as Name[];

  // Object.fromEntries types its keys as string: the keys here are the names
  // of the rules, so the result has exactly the shape the cast says.
  const buildValues = (from: Partial<Record<Name, string>>) =>
    Object.fromEntries(names.map((name) => [name, from[name] ?? ''])) as Record<
      Name,
      string
    >;
  const buildTouched = () =>
    Object.fromEntries(names.map((name) => [name, false])) as Record<
      Name,
      boolean
    >;

  const [values, setValues] = useState(() => buildValues(initialValues));
  // What "unchanged" means: the initial values, or the ones of the last reset.
  const [baseline, setBaseline] = useState(values);
  const [touched, setTouched] = useState(buildTouched);

  const isFieldValid = (name: Name) =>
    rules[name].validate(values[name], values);
  const isValid = names.every(isFieldValid);

  // Spaces around a value do not count: the API trims them before saving.
  const isDirty = names.some(
    (name) => values[name].trim() !== baseline[name].trim(),
  );

  // Starts over from `nextInitial` (or the current baseline) with no field
  // touched, for a form that stays mounted while what it edits changes.
  const reset = (nextInitial?: Partial<Record<Name, string>>) => {
    const nextValues = nextInitial ? buildValues(nextInitial) : baseline;
    setValues(nextValues);
    setBaseline(nextValues);
    setTouched(buildTouched());
  };

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

  return { values, isValid, isDirty, reset, field };
}
