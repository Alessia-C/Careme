import type { ComponentProps, ReactNode } from 'react';
import styles from './Button.module.css';

type Variant = 'primary' | 'secondary' | 'error';
type Appearance = 'solid' | 'outline' | 'text';
type Size = 'medium' | 'large';

interface ButtonProps extends Omit<ComponentProps<'button'>, 'children'> {
  label: string;
  variant?: Variant;
  appearance?: Appearance;
  icon?: ReactNode;
  size?: Size;
  // Fills the width of the parent and centres the label.
  fullWidth?: boolean;
}

const Button = ({
  label,
  variant = 'primary',
  appearance = 'solid',
  icon,
  size = 'medium',
  fullWidth = false,
  type = 'button',
  ...rest
}: ButtonProps) => {
  const className = [
    styles.button,
    styles[variant],
    styles[appearance],
    size === 'large' && styles.large,
    fullWidth && styles.fullWidth,
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <button {...rest} type={type} className={className}>
      {icon}
      <span>{label}</span>
    </button>
  );
};

export default Button;
