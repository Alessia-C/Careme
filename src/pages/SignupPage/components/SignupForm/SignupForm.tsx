import { useState, type FormEvent } from 'react';
import { Link } from 'react-router';
import Button from '../../../../components/Button/Button';
import Feedback from '../../../../components/Feedback/Feedback';
import ValidatedInput from '../../../../components/ValidatedInput/ValidatedInput';
import { useForm } from '../../../../hooks/useForm';
import { signup } from '../../../../lib/authApi';
import {
  validateEmail,
  validateInput,
  validatePassword,
} from '../../../../../shared/validation';
import PasswordFields from '../PasswordFields/PasswordFields';
import styles from './SignupForm.module.css';

const SIGNUP_ERROR_DESCRIPTIONS = {
  failed: 'We couldn’t complete your request. Please try again.',
  'rate-limited': 'Too many attempts. Please wait a moment and try again.',
};

interface SignupFormProps {
  onSuccess: () => void;
}

const SignupForm = ({ onSuccess }: SignupFormProps) => {
  const { values, isValid, field } = useForm({
    firstName: { validate: validateInput, error: 'First name is required' },
    lastName: { validate: validateInput, error: 'Last name is required' },
    email: { validate: validateEmail, error: 'Enter a valid email address' },
    password: { validate: validatePassword },
    confirmPassword: {
      validate: (confirm, current) => confirm === current.password,
    },
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorReason, setErrorReason] = useState<
    keyof typeof SIGNUP_ERROR_DESCRIPTIONS | null
  >(null);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!isValid || isSubmitting) {
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
      onSuccess();
    } else {
      setErrorReason(result.reason);
    }
  };

  return (
    <>
      {errorReason && (
        <Feedback
          status="error"
          title="Something went wrong"
          description={SIGNUP_ERROR_DESCRIPTIONS[errorReason]}
        />
      )}
      <form className={styles.form} onSubmit={handleSubmit} noValidate>
        <ValidatedInput
          label="First Name*"
          placeholder="John"
          autoComplete="given-name"
          required
          field={field('firstName')}
        />
        <ValidatedInput
          label="Last Name*"
          placeholder="Doe"
          autoComplete="family-name"
          required
          field={field('lastName')}
        />
        <ValidatedInput
          label="Email*"
          type="email"
          placeholder="john@example.com"
          autoComplete="email"
          required
          field={field('email')}
        />
        <PasswordFields
          password={field('password')}
          confirmPassword={field('confirmPassword')}
        />
        <div className={styles.actions}>
          <Button
            type="submit"
            label={isSubmitting ? 'Creating account…' : 'Create account'}
            disabled={!isValid || isSubmitting}
          />
          <p className={styles.loginRow}>
            Already have an account?{' '}
            <Link to="/login" className={styles.loginLink}>
              Log in
            </Link>
          </p>
        </div>
      </form>
    </>
  );
};

export default SignupForm;
