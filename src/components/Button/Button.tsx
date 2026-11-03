import type { ComponentProps, MouseEvent, ReactNode } from 'react';
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
  onClick,
  ...rest
}: ButtonProps) => {
  // Unlike `disabled`, `aria-disabled` keeps the focus on the button, but it
  // does not stop the click: it is ignored here, so no caller needs a guard.
  const isAriaDisabled =
    rest['aria-disabled'] === true || rest['aria-disabled'] === 'true';
  const handleClick = (event: MouseEvent<HTMLButtonElement>) => {
    if (!isAriaDisabled) {
      onClick?.(event);
    }
  };

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
    <button {...rest} type={type} className={className} onClick={handleClick}>
      {icon}
      <span>{label}</span>
    </button>
  );
};

export default Button;
