import { useEffect, useRef } from 'react';
import AuthLayout from '../../../../components/AuthLayout/AuthLayout';
import styles from './CheckEmailMessage.module.css';

const CheckEmailMessage = () => {
  const headingRef = useRef<HTMLHeadingElement>(null);

  // The form disappears on success: move focus to the new heading so screen
  // reader users hear the outcome instead of losing their place.
  useEffect(() => {
    headingRef.current?.focus();
  }, []);

  return (
    <AuthLayout
      headingRef={headingRef}
      panelClassName={styles.checkEmailPanel}
      info={{
        title: 'Account created – Careme',
        heading: 'Account created successfully!',
        description:
          'Welcome to Careme! Please check your email for confirmation.',
      }}
    />
  );
};

export default CheckEmailMessage;
