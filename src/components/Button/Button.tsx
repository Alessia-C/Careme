import type { ComponentProps } from 'react';
import styles from './Button.module.css';

type Variant = 'primary' | 'secondary' | 'error';
type Appearance = 'solid' | 'outline' | 'text';

interface ButtonProps extends Omit<ComponentProps<'button'>, 'children'> {
  label: string;
  variant?: Variant;
  appearance?: Appearance;
}

const Button = ({
  label,
  variant = 'primary',
  appearance = 'solid',
  type = 'button',
  ...rest
}: ButtonProps) => {
  const className = [styles.button, styles[variant], styles[appearance]].join(
    ' ',
  );

  return (
    <button {...rest} type={type} className={className}>
      {label}
    </button>
  );
};

export default Button;
