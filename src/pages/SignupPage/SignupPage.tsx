import { useState } from 'react';
import AuthLayout from '../../components/AuthLayout/AuthLayout';
import CheckEmailMessage from './components/CheckEmailMessage/CheckEmailMessage';
import SignupForm from './components/SignupForm/SignupForm';
import styles from './SignupPage.module.css';

const PAGE_INFO = {
  title: 'Sign up – Careme',
  // description:
  //   'Create a Careme account to manage your beauty routine and access curated essentials.',
  heading: 'Create your account',
};

function SignupPage() {
  const [isDone, setIsDone] = useState(false);

  if (isDone) {
    return <CheckEmailMessage />;
  }

  return (
    <AuthLayout info={PAGE_INFO} panelClassName={styles.signupPanel}>
      <SignupForm onSuccess={() => setIsDone(true)} />
    </AuthLayout>
  );
}

export default SignupPage;
