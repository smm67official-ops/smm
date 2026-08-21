import type { HTMLAttributes, ReactNode } from 'react';

export type CardProps = HTMLAttributes<HTMLDivElement> & {
  variant?: 'default' | 'accent' | 'glass';
  size?: 'md' | 'lg';
  interactive?: boolean;
};

export function Card({
  variant = 'default',
  size = 'md',
  interactive = false,
  className = '',
  children,
  ...rest
}: CardProps) {
  const classes = [
    'sv-card',
    variant !== 'default' && `sv-card--${variant}`,
    size === 'lg' && 'sv-card--lg',
    interactive && 'sv-card--interactive',
    className,
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <div className={classes} {...rest}>
      {children}
    </div>
  );
}

export function CardHeader({
  title,
  subtitle,
  action,
  className = '',
}: {
  title: ReactNode;
  subtitle?: ReactNode;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div className={`sv-card__header ${className}`.trim()}>
      <div style={{ minWidth: 0 }}>
        <h3 className="sv-card__title">{title}</h3>
        {subtitle && <p className="sv-card__subtitle">{subtitle}</p>}
      </div>
      {action && <div style={{ marginInlineStart: 'auto' }}>{action}</div>}
    </div>
  );
}

export function CardBody({ className = '', children, ...rest }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={`sv-card__body ${className}`.trim()} {...rest}>
      {children}
    </div>
  );
}

export function CardFooter({ className = '', children, ...rest }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={`sv-card__footer ${className}`.trim()} {...rest}>
      {children}
    </div>
  );
}

export default Card;
