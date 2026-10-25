import { useEffect, useRef } from 'react';
import AuthLayout from '../../../../components/AuthLayout/AuthLayout';

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
