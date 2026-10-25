import { useId, type ComponentProps } from 'react';
import FormField, { type FieldStatus } from '../FormField/FormField';
import fieldStyles from '../FormField/FormField.module.css';
import styles from './Textarea.module.css';

interface TextareaProps extends Omit<ComponentProps<'textarea'>, 'id'> {
  label: string;
  helperText?: string;
  status?: FieldStatus;
}

const Textarea = ({
  label,
  helperText,
  status = 'default',
  disabled,
  ...rest
}: TextareaProps) => {
  const id = useId();

  return (
    <FormField
      id={id}
      label={label}
      status={status}
      disabled={disabled}
      helper={helperText}
    >
      <textarea
        {...rest}
        id={id}
        disabled={disabled}
        className={[fieldStyles.control, styles.textarea].join(' ')}
        aria-invalid={status === 'error' || undefined}
        aria-describedby={helperText ? `${id}-helper` : undefined}
      />
    </FormField>
  );
};

export default Textarea;
