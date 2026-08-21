'use client';

import type { ReactNode } from 'react';

export type TabItem = { id: string; label: ReactNode; badge?: ReactNode };

export type TabsProps = {
  items: TabItem[];
  value: string;
  onChange: (id: string) => void;
  variant?: 'underline' | 'pill';
  className?: string;
};

export default function Tabs({ items, value, onChange, variant = 'underline', className = '' }: TabsProps) {
  return (
    <div
      className={`sv-tabs${variant === 'pill' ? ' sv-tabs--pill' : ''} ${className}`.trim()}
      role="tablist"
    >
      {items.map((item) => (
        <button
          key={item.id}
          type="button"
          role="tab"
          aria-selected={value === item.id}
          className={`sv-tab${value === item.id ? ' sv-tab--active' : ''}`}
          onClick={() => onChange(item.id)}
        >
          {item.label}
          {item.badge}
        </button>
      ))}
    </div>
  );
}
