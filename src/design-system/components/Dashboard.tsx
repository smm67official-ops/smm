import type { ReactNode } from 'react';
import Icon from '@/design-system/components/Icon';

/* ---------- Stat card ---------- */
export type StatCardProps = {
  label: ReactNode;
  value: ReactNode;
  icon?: ReactNode;
  trend?: { direction: 'up' | 'down'; value: string };
  caption?: ReactNode;
  chart?: ReactNode;
};

export function StatCard({ label, value, icon, trend, caption, chart }: StatCardProps) {
  return (
    <div className="sv-stat">
      <div className="sv-stat__head">
        {icon && <span className="sv-stat__icon">{icon}</span>}
        <span className="sv-stat__label">{label}</span>
      </div>
      <div className="sv-stat__value">{value}</div>
      {chart}
      {(trend || caption) && (
        <div className="sv-stat__foot">
          {trend && (
            <span className={`sv-trend sv-trend--${trend.direction}`}>
              <Icon name={trend.direction === 'up' ? 'trendingUp' : 'trendingDown'} size={14} />
              {trend.value}
            </span>
          )}
          {caption && <span className="sv-caption">{caption}</span>}
        </div>
      )}
    </div>
  );
}

/* ---------- Progress ---------- */
export function Progress({ value, label }: { value: number; label?: ReactNode }) {
  const clamped = Math.max(0, Math.min(100, value));
  return (
    <div className="sv-stack" style={{ gap: 'var(--sv-space-2)' }}>
      {label && (
        <div className="sv-row" style={{ justifyContent: 'space-between' }}>
          <span className="sv-caption">{label}</span>
          <span className="sv-caption">{clamped}%</span>
        </div>
      )}
      <div
        className="sv-progress"
        role="progressbar"
        aria-valuenow={clamped}
        aria-valuemin={0}
        aria-valuemax={100}
      >
        <div className="sv-progress__bar" style={{ width: `${clamped}%` }} />
      </div>
    </div>
  );
}

/* ---------- Sparkline ---------- */
export function Sparkline({ points, stroke = 'var(--sv-primary)' }: { points: number[]; stroke?: string }) {
  if (points.length < 2) return null;

  const max = Math.max(...points);
  const min = Math.min(...points);
  const span = max - min || 1;
  const step = 100 / (points.length - 1);

  const path = points
    .map((point, i) => `${i === 0 ? 'M' : 'L'} ${(i * step).toFixed(2)} ${(28 - ((point - min) / span) * 24).toFixed(2)}`)
    .join(' ');

  const area = `${path} L 100 28 L 0 28 Z`;

  return (
    <svg className="sv-sparkline" viewBox="0 0 100 28" preserveAspectRatio="none" aria-hidden="true">
      <defs>
        <linearGradient id="sv-spark" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="var(--sv-gradient-end)" stopOpacity="0.22" />
          <stop offset="100%" stopColor="var(--sv-gradient-start)" stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={area} fill="url(#sv-spark)" />
      <path d={path} fill="none" stroke={stroke} strokeWidth="1.6" vectorEffect="non-scaling-stroke" />
    </svg>
  );
}

/* ---------- Activity feed ---------- */
export type ActivityItem = { id: string; title: ReactNode; time: ReactNode; icon?: ReactNode; trailing?: ReactNode };

export function ActivityFeed({ items }: { items: ActivityItem[] }) {
  return (
    <div className="sv-activity">
      {items.map((item) => (
        <div className="sv-activity__item" key={item.id}>
          {item.icon && <span className="sv-stat__icon">{item.icon}</span>}
          <div className="sv-activity__content">
            <div className="sv-activity__title">{item.title}</div>
            <div className="sv-activity__time">{item.time}</div>
          </div>
          {item.trailing}
        </div>
      ))}
    </div>
  );
}
