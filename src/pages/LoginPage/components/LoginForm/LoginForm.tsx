import { useState, type FormEvent } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router';
import Button from '../../../../components/Button/Button';
import Feedback from '../../../../components/Feedback/Feedback';
import PasswordInput from '../../../../components/PasswordInput/PasswordInput';
import ValidatedInput from '../../../../components/ValidatedInput/ValidatedInput';
import { useForm } from '../../../../hooks/useForm';
import { login } from '../../../../lib/authApi';
import { getSafeNextPath } from '../../../../lib/redirect';
import useAuthStore from '../../../../stores/authStore';
import { validateEmail } from '../../../../../shared/validation';
import styles from './LoginForm.module.css';

const LOGIN_ERROR_DESCRIPTIONS = {
  'invalid-credentials': 'Invalid email or password.',
  failed: 'We couldn’t complete your request. Please try again.',
  'rate-limited': 'Too many attempts. Please wait a moment and try again.',
};

const LoginForm = () => {
  const { values, isValid, field } = useForm({
    email: { validate: validateEmail, error: 'Enter a valid email address' },
    password: { validate: (password) => password.length > 0 },
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorReason, setErrorReason] = useState<
    keyof typeof LOGIN_ERROR_DESCRIPTIONS | null
  >(null);
  const setSession = useAuthStore((state) => state.setSession);
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const passwordField = field('password');

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!isValid || isSubmitting) {
      return;
    }

    setIsSubmitting(true);
    setErrorReason(null);

    const result = await login({
      email: values.email,
      password: values.password,
    });

    setIsSubmitting(false);

    if (result.ok) {
      setSession(result.user, result.role);
      navigate(getSafeNextPath(searchParams.get('next')), { replace: true });
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
          description={LOGIN_ERROR_DESCRIPTIONS[errorReason]}
        />
      )}
      <form className={styles.form} onSubmit={handleSubmit} noValidate>
        <ValidatedInput
          label="Email*"
          type="email"
          placeholder="john@example.com"
          autoComplete="email"
          required
          field={field('email')}
        />
        <div className={styles.passwordGroup}>
          <PasswordInput
            label="Password*"
            placeholder="Enter your password"
            autoComplete="current-password"
            requirements={[]}
            required
            value={passwordField.value}
            onChange={passwordField.onChange}
            onBlur={passwordField.onBlur}
            status={passwordField.hasError ? 'error' : 'default'}
          />
          {/* Password recovery does not exist yet. */}
          <Button
            label="Forgot password?"
            variant="secondary"
            appearance="text"
            disabled
            className={styles.forgotPassword}
          />
        </div>
        <div className={styles.actions}>
          <Button
            type="submit"
            label={isSubmitting ? 'Signing in…' : 'Sign in'}
            disabled={!isValid || isSubmitting}
          />
          <p className={styles.signupRow}>
            You don’t have an account?{' '}
            <Link to="/signup" className={styles.signupLink}>
              Go to the registration
            </Link>
          </p>
        </div>
      </form>
    </>
  );
};

export default LoginForm;
