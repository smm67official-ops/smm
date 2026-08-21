'use client';

import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import type { Locale } from '@/i18n/config';
import type { Dictionary } from '@/i18n';

/** Filtres de commandes : trois choix, pas de menu déroulant sur mobile. */
export default function OrderFilterChips({
  locale,
  t,
  counts,
}: {
  locale: Locale;
  t: Dictionary;
  counts: { all: number; active: number; completed: number };
}) {
  const searchParams = useSearchParams();
  const current = searchParams.get('status') ?? 'all';

  const chips = [
    { id: 'all', label: t.dashboard.filterAll, count: counts.all },
    { id: 'active', label: t.dashboard.inProgress, count: counts.active },
    { id: 'completed', label: t.dashboard.completed, count: counts.completed },
  ];

  return (
    <div style={{ display: 'flex', gap: 8, overflowX: 'auto', paddingBottom: 4 }}>
      {chips.map((chip) => {
        const active = current === chip.id;
        return (
          <Link
            key={chip.id}
            href={chip.id === 'all' ? `/${locale}/account/orders` : `/${locale}/account/orders?status=${chip.id}`}
            className="cx-badge"
            style={{
              padding: '9px 15px',
              fontSize: 13,
              background: active ? '#16162b' : '#fff',
              color: active ? '#fff' : '#6b7280',
              border: active ? '1px solid #16162b' : '1px solid #ebedf3',
              whiteSpace: 'nowrap',
            }}
          >
            {chip.label}
            <b style={{ opacity: 0.7 }}>{chip.count}</b>
          </Link>
        );
      })}
    </div>
  );
}
