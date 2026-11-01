import type { ComponentProps } from 'react';
import type { FieldBinding } from '../../hooks/useForm/useForm';
import Input from '../Input/Input';

type ValidatedInputProps = Omit<
  ComponentProps<typeof Input>,
  'value' | 'onChange' | 'onBlur' | 'status' | 'helperText'
> & {
  // Comes from `useForm().field(name)`.
  field: FieldBinding;
};

// Input wired to a useForm field: maps its error state to status + message.
const ValidatedInput = ({ field, ...rest }: ValidatedInputProps) => (
  <Input
    {...rest}
    value={field.value}
    onChange={field.onChange}
    onBlur={field.onBlur}
    status={field.hasError ? 'error' : 'default'}
    helperText={field.error}
  />
);

export default ValidatedInput;
