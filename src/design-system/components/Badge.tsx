import type { HTMLAttributes, ReactNode } from 'react';
import { SV_PLATFORMS, platformStyle, type SvPlatform } from '@/design-system/platforms';

export type BadgeTone = 'neutral' | 'info' | 'success' | 'warning' | 'error' | 'gradient' | 'outline';

export type BadgeProps = HTMLAttributes<HTMLSpanElement> & {
  tone?: BadgeTone;
  dot?: boolean;
  icon?: ReactNode;
};

export function Badge({ tone = 'neutral', dot = false, icon, className = '', children, ...rest }: BadgeProps) {
  const classes = ['sv-badge', `sv-badge--${tone}`, dot && 'sv-badge--dot', className]
    .filter(Boolean)
    .join(' ');

  return (
    <span className={classes} {...rest}>
      {icon}
      {children}
    </span>
  );
}

/** Identification de plateforme : la couleur de marque reste un simple accent. */
export function PlatformBadge({ platform, className = '' }: { platform: SvPlatform; className?: string }) {
  return (
    <span className={`sv-badge sv-badge--platform ${className}`.trim()} style={platformStyle(platform)}>
      <span className="sv-badge__dot" />
      {SV_PLATFORMS[platform].label}
    </span>
  );
}

export default Badge;
