import type { ButtonHTMLAttributes, ReactNode } from 'react';

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';
export type ButtonSize = 'sm' | 'md' | 'lg';

export type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
  size?: ButtonSize;
  block?: boolean;
  loading?: boolean;
  iconOnly?: boolean;
  leadingIcon?: ReactNode;
  trailingIcon?: ReactNode;
};

export default function Button({
  variant = 'primary',
  size = 'md',
  block = false,
  loading = false,
  iconOnly = false,
  leadingIcon,
  trailingIcon,
  className = '',
  children,
  disabled,
  type = 'button',
  ...rest
}: ButtonProps) {
  const classes = [
    'sv-btn',
    `sv-btn--${variant}`,
    size !== 'md' && `sv-btn--${size}`,
    block && 'sv-btn--block',
    iconOnly && 'sv-btn--icon',
    className,
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <button type={type} className={classes} disabled={disabled || loading} {...rest}>
      {loading ? <span className="sv-btn__spinner" /> : leadingIcon}
      {!iconOnly && children}
      {!loading && trailingIcon}
    </button>
  );
}
