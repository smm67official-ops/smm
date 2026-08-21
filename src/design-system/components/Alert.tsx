import type { ReactNode } from 'react';
import Icon, { type IconName } from '@/design-system/components/Icon';

export type AlertTone = 'info' | 'success' | 'warning' | 'error';

const ICONS: Record<AlertTone, IconName> = {
  info: 'info',
  success: 'check',
  warning: 'alert',
  error: 'alert',
};

export default function Alert({
  tone = 'info',
  title,
  children,
  action,
  className = '',
}: {
  tone?: AlertTone;
  title?: ReactNode;
  children?: ReactNode;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div className={`sv-alert sv-alert--${tone} ${className}`.trim()} role={tone === 'error' ? 'alert' : 'status'}>
      <span className="sv-alert__icon">
        <Icon name={ICONS[tone]} size={18} />
      </span>
      <div style={{ flex: 1, minWidth: 0 }}>
        {title && <p className="sv-alert__title">{title}</p>}
        {children && <p className="sv-alert__body">{children}</p>}
      </div>
      {action}
    </div>
  );
}
