// Result of validating the input of an endpoint: the values to use, or the
// message for the first invalid field.
export type Parsed<T> = { ok: true; value: T } | { ok: false; message: string };

export const invalid = (message: string): Parsed<never> => ({
  ok: false,
  message,
});
