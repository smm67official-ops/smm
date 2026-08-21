import type { ReactNode } from 'react';
import Icon from '@/design-system/components/Icon';

export type AvatarSize = 'sm' | 'md' | 'lg' | 'xl';

export type AvatarProps = {
  name?: string;
  src?: string;
  size?: AvatarSize;
  ring?: boolean;
  verified?: boolean;
  className?: string;
};

const initialsOf = (name = '') =>
  name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('');

export function Avatar({ name, src, size = 'md', ring = false, verified = false, className = '' }: AvatarProps) {
  const classes = ['sv-avatar', size !== 'md' && `sv-avatar--${size}`, ring && 'sv-avatar--ring', className]
    .filter(Boolean)
    .join(' ');

  return (
    <span className={classes} title={name}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      {src ? <img src={src} alt={name ?? ''} /> : <span>{initialsOf(name) || '?'}</span>}
      {verified && (
        <span className="sv-avatar__check" aria-label="Verified">
          <Icon name="check" size={10} strokeWidth={3} />
        </span>
      )}
    </span>
  );
}

export function AvatarGroup({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <span className={`sv-avatar-group ${className}`.trim()}>{children}</span>;
}

export default Avatar;
