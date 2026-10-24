import { useId, type ComponentProps } from 'react';
import FormField, { type FieldStatus } from '../FormField/FormField';
import fieldStyles from '../FormField/FormField.module.css';

interface InputProps extends Omit<ComponentProps<'input'>, 'id'> {
  label: string;
  helperText?: string;
  status?: FieldStatus;
}

const Input = ({
  label,
  helperText,
  status = 'default',
  disabled,
  ...rest
}: InputProps) => {
  const id = useId();

  return (
    <FormField
      id={id}
      label={label}
      status={status}
      disabled={disabled}
      helper={helperText}
    >
      <input
        {...rest}
        id={id}
        disabled={disabled}
        className={fieldStyles.control}
        aria-invalid={status === 'error' || undefined}
        aria-describedby={helperText ? `${id}-helper` : undefined}
      />
    </FormField>
  );
};

export default Input;
