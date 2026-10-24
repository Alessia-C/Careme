import { useId, useState, type ComponentProps } from 'react';
import FormField, { type FieldStatus } from '../FormField/FormField';
import fieldStyles from '../FormField/FormField.module.css';
import eyeIcon from '../../assets/icons/EyeIcon.svg';
import eyeOffIcon from '../../assets/icons/EyeOffIcon.svg';
import styles from './PasswordInput.module.css';

const DEFAULT_REQUIREMENTS = [
  'Minimo 8 caratteri',
  '1 lettera maiuscola',
  '1 numero',
  '1 carattere speciale',
];

interface PasswordInputProps extends Omit<
  ComponentProps<'input'>,
  'id' | 'type'
> {
  label?: string;
  // Pass an empty array to hide the requirements list.
  requirements?: string[];
  status?: FieldStatus;
}

const PasswordInput = ({
  label = 'Password',
  requirements = DEFAULT_REQUIREMENTS,
  status = 'default',
  disabled,
  ...rest
}: PasswordInputProps) => {
  const id = useId();
  const [isVisible, setIsVisible] = useState(false);

  const helper =
    requirements.length > 0 ? (
      <ul className={styles.requirements}>
        {requirements.map((requirement) => (
          <li key={requirement}>{requirement}</li>
        ))}
      </ul>
    ) : undefined;

  return (
    <FormField
      id={id}
      label={label}
      status={status}
      disabled={disabled}
      helper={helper}
    >
      <input
        {...rest}
        id={id}
        type={isVisible ? 'text' : 'password'}
        disabled={disabled}
        className={fieldStyles.control}
        aria-invalid={status === 'error' || undefined}
        aria-describedby={helper ? `${id}-helper` : undefined}
      />
      {/* The label stays constant; aria-pressed carries the state. */}
      <button
        type="button"
        className={styles.toggle}
        disabled={disabled}
        aria-label="Mostra password"
        aria-pressed={isVisible}
        onClick={() => setIsVisible((current) => !current)}
      >
        <img src={isVisible ? eyeOffIcon : eyeIcon} alt="" />
      </button>
    </FormField>
  );
};

export default PasswordInput;
