import Link from 'next/link';
import { money, formatDate } from '@/lib/format';
import { platformOf } from '@/lib/platforms';
import type { Dictionary } from '@/i18n';
import type { OrderStatus } from '@/lib/supabase/types';

/** Correspondance statut → classe de badge et libellé traduit. */
export const STATUS_CLASS: Record<string, string> = {
  pending: 'cx-badge--pending',
  processing: 'cx-badge--processing',
  in_progress: 'cx-badge--processing',
  completed: 'cx-badge--completed',
  partial: 'cx-badge--partial',
  canceled: 'cx-badge--canceled',
  refunded: 'cx-badge--canceled',
  failed: 'cx-badge--failed',
};

export function statusLabel(t: Dictionary, status: string) {
  const map = t.orderStatus as Record<string, string>;
  return map[status] ?? status;
}

export type OrderCardData = {
  id: string;
  status: OrderStatus | string;
  total: number;
  created_at: string;
  service_name: string | null;
  extra_items: number;
  quantity: number;
  platform?: string | null;
};

/**
 * Carte de commande verticale — remplace la ligne de tableau.
 * Toute la carte est cliquable : cible tactile maximale.
 */
export default function OrderCard({
  order,
  locale,
  t,
}: {
  order: OrderCardData;
  locale: string;
  t: Dictionary;
}) {
  const platform = platformOf(order.platform);

  return (
    <Link href={`/${locale}/account/orders/${order.id}`} className="cx-order"
      data-motion="item"
      data-hover="lift"
    >
      <div className="cx-order__top">
        <span className="cx-order__icon">
          <i className={platform?.icon ?? 'ion-bag'} />
        </span>
        <div style={{ minWidth: 0, flex: 1 }}>
          <h3 className="cx-order__title">
            {order.service_name ?? t.orderHistory.colService}
            {order.extra_items > 0 && (
              <span style={{ color: '#9ca3af' }}> +{order.extra_items}</span>
            )}
          </h3>
          <p className="cx-order__meta">
            #{order.id.slice(0, 8).toUpperCase()} · {formatDate(order.created_at)} ·{' '}
            {order.quantity.toLocaleString()}
          </p>
        </div>
        <span className={`cx-badge ${STATUS_CLASS[order.status] ?? 'cx-badge--canceled'}`}>
          <span className="cx-badge__dot" />
          {statusLabel(t, order.status)}
        </span>
      </div>

      <div className="cx-order__row">
        <span className="cx-order__price">{money(order.total)}</span>
        <span className="cx-order__cta">
          {t.orderHistory.view}
          <i className="ion-chevron-right" />
        </span>
      </div>
    </Link>
  );
}
