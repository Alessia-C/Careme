import { useId, useState, type ChangeEvent, type ComponentProps } from 'react';
import FormField, { type FieldStatus } from '../FormField/FormField';
import fieldStyles from '../FormField/FormField.module.css';
import eyeIcon from '../../assets/icons/EyeIcon.svg';
import eyeOffIcon from '../../assets/icons/EyeOffIcon.svg';
import styles from './PasswordInput.module.css';
import {
  PASSWORD_LOWERCASE_REGEX,
  PASSWORD_MAX_LENGTH,
  PASSWORD_MIN_LENGTH,
  PASSWORD_NUMBER_REGEX,
  PASSWORD_SPECIAL_CHAR_REGEX,
  PASSWORD_UPPERCASE_REGEX,
} from '../../../shared/validation';

export interface PasswordRequirement {
  label: string;
  isMet: (password: string) => boolean;
}

// Same rules as validatePassword in shared/validation.ts: the server is the
// source of truth, the checklist only mirrors it while the user types.
const DEFAULT_REQUIREMENTS: PasswordRequirement[] = [
  {
    label: `Minimum ${PASSWORD_MIN_LENGTH} characters`,
    isMet: (password) => password.length >= PASSWORD_MIN_LENGTH,
  },
  {
    label: `Maximum ${PASSWORD_MAX_LENGTH} characters`,
    isMet: (password) =>
      password.length > 0 && password.length <= PASSWORD_MAX_LENGTH,
  },
  {
    label: '1 uppercase letter',
    isMet: (password) => PASSWORD_UPPERCASE_REGEX.test(password),
  },
  {
    label: '1 lowercase letter',
    isMet: (password) => PASSWORD_LOWERCASE_REGEX.test(password),
  },
  {
    label: '1 number',
    isMet: (password) => PASSWORD_NUMBER_REGEX.test(password),
  },
  {
    label: '1 special character',
    isMet: (password) => PASSWORD_SPECIAL_CHAR_REGEX.test(password),
  },
];

interface PasswordInputProps extends Omit<
  ComponentProps<'input'>,
  'id' | 'type'
> {
  label?: string;
  // Pass an empty array to hide the requirements list.
  requirements?: PasswordRequirement[];
  status?: FieldStatus;
}

const PasswordInput = ({
  label = 'Password',
  requirements = DEFAULT_REQUIREMENTS,
  status = 'default',
  disabled,
  value,
  defaultValue,
  onChange,
  ...rest
}: PasswordInputProps) => {
  const id = useId();
  const [isVisible, setIsVisible] = useState(false);
  // Needed only when the input is uncontrolled: a controlled `value` prop
  // is always the source of truth.
  const [typedValue, setTypedValue] = useState(() =>
    String(defaultValue ?? ''),
  );
  const currentValue = value !== undefined ? String(value) : typedValue;

  const handleChange = (event: ChangeEvent<HTMLInputElement>) => {
    setTypedValue(event.target.value);
    onChange?.(event);
  };

  const helper =
    requirements.length > 0 ? (
      <ul className={styles.requirements}>
        {requirements.map((requirement) => (
          <li
            key={requirement.label}
            className={styles.requirement}
            data-met={requirement.isMet(currentValue) || undefined}
          >
            {requirement.label}
          </li>
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
        value={value}
        defaultValue={defaultValue}
        onChange={handleChange}
        className={fieldStyles.control}
        aria-invalid={status === 'error' || undefined}
        aria-describedby={helper ? `${id}-helper` : undefined}
      />
      <button
        type="button"
        className={styles.toggle}
        disabled={disabled}
        aria-label="Show password"
        aria-pressed={isVisible}
        onClick={() => setIsVisible((current) => !current)}
      >
        <img src={isVisible ? eyeOffIcon : eyeIcon} alt="" />
      </button>
    </FormField>
  );
};

export default PasswordInput;
