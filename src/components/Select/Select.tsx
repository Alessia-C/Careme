import { useId, type ComponentProps } from 'react';
import FormField, { type FieldStatus } from '../FormField/FormField';
import fieldStyles from '../FormField/FormField.module.css';
import chevronIcon from '../../assets/icons/Chevron.svg';
import styles from './Select.module.css';

interface SelectProps extends Omit<ComponentProps<'select'>, 'id'> {
  label: string;
  helperText?: string;
  status?: FieldStatus;
}

// Native <select> so keyboard and mobile pickers work out of the box.
// Pass a disabled <option value=""> as the first child for a placeholder.
const Select = ({
  label,
  helperText,
  status = 'default',
  disabled,
  children,
  ...rest
}: SelectProps) => {
  const id = useId();

  return (
    <FormField
      id={id}
      label={label}
      status={status}
      disabled={disabled}
      helper={helperText}
    >
      <select
        {...rest}
        id={id}
        disabled={disabled}
        className={[fieldStyles.control, styles.select].join(' ')}
        aria-invalid={status === 'error' || undefined}
        aria-describedby={helperText ? `${id}-helper` : undefined}
      >
        {children}
      </select>
      <img src={chevronIcon} alt="" className={styles.chevron} />
    </FormField>
  );
};

export default Select;
