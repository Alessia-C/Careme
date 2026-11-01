import type { ComponentProps } from 'react';
import type { FieldBinding } from '../../hooks/useForm/useForm';
import Input from '../Input/Input';

type ValidatedInputProps = Omit<
  ComponentProps<typeof Input>,
  'value' | 'onChange' | 'onBlur' | 'status' | 'helperText'
> & {
  // Comes from `useForm().field(name)`.
  field: FieldBinding;
  // Forces the error look when the problem does not come from the field's own
  // rule (e.g. a duplicate found by the server).
  invalid?: boolean;
};

// Input wired to a useForm field: maps its error state to status + message.
const ValidatedInput = ({ field, invalid, ...rest }: ValidatedInputProps) => (
  <Input
    {...rest}
    value={field.value}
    onChange={field.onChange}
    onBlur={field.onBlur}
    status={field.hasError || invalid ? 'error' : 'default'}
    helperText={field.error}
  />
);

export default ValidatedInput;
