import type { ReactNode } from 'react';
import styles from './FormField.module.css';

export type FieldStatus = 'default' | 'error' | 'success';

interface FormFieldProps {
  id: string;
  label?: string;
  status?: FieldStatus;
  disabled?: boolean;
  helper?: ReactNode;
  children: ReactNode;
}

// Shared frame for every form control: label, bordered box, helper text.
// The control itself (input, select, textarea) is passed as children and
// receives `id` and `aria-describedby` from the component that uses it.
const FormField = ({
  id,
  label,
  status = 'default',
  disabled = false,
  helper,
  children,
}: FormFieldProps) => (
  <div
    className={styles.field}
    data-status={status}
    data-disabled={disabled || undefined}
  >
    {label && (
      <label htmlFor={id} className={styles.label}>
        {label}
      </label>
    )}
    <div className={styles.box}>{children}</div>
    {helper && (
      <div id={`${id}-helper`} className={styles.helper}>
        {helper}
      </div>
    )}
  </div>
);

export default FormField;
