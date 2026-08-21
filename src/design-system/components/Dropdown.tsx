'use client';

import { useEffect, useRef, useState, type ReactNode } from 'react';

export type DropdownItem =
  | { type: 'item'; id: string; label: ReactNode; icon?: ReactNode; danger?: boolean; onSelect?: () => void }
  | { type: 'label'; id: string; label: ReactNode }
  | { type: 'divider'; id: string };

export type DropdownProps = {
  trigger: (props: { open: boolean; toggle: () => void }) => ReactNode;
  items: DropdownItem[];
  align?: 'start' | 'end';
};

export default function Dropdown({ trigger, items, align = 'start' }: DropdownProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;

    const onClickOutside = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };

    document.addEventListener('mousedown', onClickOutside);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('mousedown', onClickOutside);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [open]);

  return (
    <div className="sv-dropdown" ref={ref}>
      {trigger({ open, toggle: () => setOpen((v) => !v) })}

      {open && (
        <div className={`sv-menu${align === 'end' ? ' sv-menu--end' : ''}`} role="menu">
          {items.map((item) => {
            if (item.type === 'divider') return <div key={item.id} className="sv-menu__divider" />;
            if (item.type === 'label')
              return (
                <div key={item.id} className="sv-menu__label">
                  {item.label}
                </div>
              );

            return (
              <button
                key={item.id}
                type="button"
                role="menuitem"
                className={`sv-menu__item${item.danger ? ' sv-menu__item--danger' : ''}`}
                onClick={() => {
                  item.onSelect?.();
                  setOpen(false);
                }}
              >
                {item.icon}
                {item.label}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
