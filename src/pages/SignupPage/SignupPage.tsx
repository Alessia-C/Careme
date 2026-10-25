import {
  useEffect,
  useRef,
  useState,
  type ChangeEvent,
  type FormEvent,
} from 'react';
import { Link } from 'react-router';
import AuthLayout from '../../components/AuthLayout/AuthLayout';
import Button from '../../components/Button/Button';
import Feedback from '../../components/Feedback/Feedback';
import Input from '../../components/Input/Input';
import type { FieldStatus } from '../../components/FormField/FormField';
import PasswordInput from '../../components/PasswordInput/PasswordInput';
import { signup } from '../../lib/authApi';
import {
  validateEmail,
  validateInput,
  validatePassword,
} from '../../../shared/validation';
import styles from './SignupPage.module.css';

type TextField = 'firstName' | 'lastName' | 'email';
type FieldName = TextField | 'password' | 'confirmPassword';

const TEXT_FIELDS: TextField[] = ['firstName', 'lastName', 'email'];

const FIELD_ERRORS: Record<TextField, string> = {
  firstName: 'First name is required',
  lastName: 'Last name is required',
  email: 'Enter a valid email address',
};

const FIELD_VALIDATORS: Record<TextField, (value: string) => boolean> = {
  firstName: validateInput,
  lastName: validateInput,
  email: validateEmail,
};

const SIGNUP_ERROR_DESCRIPTIONS = {
  failed: 'We couldn’t complete your request. Please try again.',
  'rate-limited': 'Too many attempts. Please wait a moment and try again.',
};

function CheckEmailMessage() {
  const headingRef = useRef<HTMLHeadingElement>(null);

  // The form disappears on success: move focus to the new heading so screen
  // reader users hear the outcome instead of losing their place.
  useEffect(() => {
    headingRef.current?.focus();
  }, []);

  return (
    <AuthLayout
      info={{
        title: 'Account created – Careme',
        heading: 'Account created successfully!',
        description:
          'Welcome to Careme! Please check your email for confirmation.',
      }}
    />
  );
}

function SignupPage() {
  const [values, setValues] = useState({
    firstName: '',
    lastName: '',
    email: '',
    password: '',
    confirmPassword: '',
  });
  // A field is "touched" once the user has left it: errors show only then.
  const [touched, setTouched] = useState<Record<FieldName, boolean>>({
    firstName: false,
    lastName: false,
    email: false,
    password: false,
    confirmPassword: false,
  });
  const [isPasswordFocused, setIsPasswordFocused] = useState(false);
  const [isConfirmFocused, setIsConfirmFocused] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorReason, setErrorReason] = useState<
    keyof typeof SIGNUP_ERROR_DESCRIPTIONS | null
  >(null);
  const [isDone, setIsDone] = useState(false);

  const isFormValid =
    TEXT_FIELDS.every((field) => FIELD_VALIDATORS[field](values[field])) &&
    validatePassword(values.password) &&
    values.confirmPassword === values.password;

  const handleChange =
    (field: FieldName) => (event: ChangeEvent<HTMLInputElement>) => {
      setValues((current) => ({ ...current, [field]: event.target.value }));
    };

  const handleBlur = (field: FieldName) => () => {
    setTouched((current) => ({ ...current, [field]: true }));
  };

  const fieldProps = (field: TextField) => {
    const hasError = touched[field] && !FIELD_VALIDATORS[field](values[field]);
    const status: FieldStatus = hasError ? 'error' : 'default';
    return {
      value: values[field],
      onChange: handleChange(field),
      onBlur: handleBlur(field),
      status,
      required: true,
      helperText: hasError ? FIELD_ERRORS[field] : undefined,
    };
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!isFormValid || isSubmitting) {
      return;
    }

    setIsSubmitting(true);
    setErrorReason(null);

    const result = await signup({
      firstName: values.firstName,
      lastName: values.lastName,
      email: values.email,
      password: values.password,
    });

    setIsSubmitting(false);

    if (result.ok) {
      setIsDone(true);
    } else {
      setErrorReason(result.reason);
    }
  };

  if (isDone) {
    return <CheckEmailMessage />;
  }

  const pageInfo = {
    title: 'Sign up – Careme',
    description:
      'Create a Careme account to manage your beauty routine and access curated essentials.',
    heading: 'Create your account',
  };

  return (
    <AuthLayout info={pageInfo}>
      {errorReason && (
        <Feedback
          status="error"
          title="Something went wrong"
          description={SIGNUP_ERROR_DESCRIPTIONS[errorReason]}
        />
      )}
      <form className={styles.form} onSubmit={handleSubmit} noValidate>
        {/* <div className={styles.nameRow}> */}
        <Input
          label="First Name*"
          placeholder="John"
          autoComplete="given-name"
          {...fieldProps('firstName')}
        />
        <Input
          label="Last Name*"
          placeholder="Doe"
          autoComplete="family-name"
          {...fieldProps('lastName')}
        />
        {/* </div> */}
        <Input
          label="Email*"
          type="email"
          placeholder="john@example.com"
          autoComplete="email"
          {...fieldProps('email')}
        />
        <PasswordInput
          label="Password*"
          placeholder="Create a password"
          autoComplete="new-password"
          value={values.password}
          onChange={handleChange('password')}
          onFocus={() => setIsPasswordFocused(true)}
          onBlur={() => {
            setIsPasswordFocused(false);
            handleBlur('password')();
          }}
          required
          // The checklist is visible only while the field has focus; after
          // blur only the error status remains.
          requirements={isPasswordFocused ? undefined : []}
          status={
            touched.password && !validatePassword(values.password)
              ? 'error'
              : 'default'
          }
        />
        <PasswordInput
          label="Confirm Password*"
          placeholder="Confirm your password"
          autoComplete="new-password"
          value={values.confirmPassword}
          onChange={handleChange('confirmPassword')}
          onFocus={() => setIsConfirmFocused(true)}
          onBlur={() => {
            setIsConfirmFocused(false);
            handleBlur('confirmPassword')();
          }}
          required
          // Reuses the checklist as the only message for this field, shown
          // only while focused.
          requirements={
            isConfirmFocused
              ? [
                  {
                    label: 'Passwords match',
                    isMet: (confirm) =>
                      confirm.length > 0 && confirm === values.password,
                  },
                ]
              : []
          }
          status={
            touched.confirmPassword &&
            values.confirmPassword !== values.password
              ? 'error'
              : 'default'
          }
        />
        <div className={styles.actions}>
          <Button
            type="submit"
            label={isSubmitting ? 'Creating account…' : 'Create account'}
            disabled={!isFormValid || isSubmitting}
          />
          <p className={styles.loginRow}>
            Already have an account?{' '}
            <Link to="/login" className={styles.loginLink}>
              Log in
            </Link>
          </p>
        </div>
      </form>
    </AuthLayout>
  );
}

export default SignupPage;
