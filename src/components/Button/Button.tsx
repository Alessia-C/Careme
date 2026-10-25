import type { ComponentProps, ReactNode } from 'react';
import styles from './Button.module.css';

type Variant = 'primary' | 'secondary' | 'error';
type Appearance = 'solid' | 'outline' | 'text';

interface ButtonProps extends Omit<ComponentProps<'button'>, 'children'> {
  label: string;
  variant?: Variant;
  appearance?: Appearance;
  icon?: ReactNode;
}

const Button = ({
  label,
  variant = 'primary',
  appearance = 'solid',
  icon,
  type = 'button',
  ...rest
}: ButtonProps) => {
  const className = [styles.button, styles[variant], styles[appearance]].join(
    ' ',
  );

  return (
    <button {...rest} type={type} className={className}>
      {icon}
      <span>{label}</span>
    </button>
  );
};

export default Button;
