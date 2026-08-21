import Link from 'next/link';
import { redirect } from 'next/navigation';
import OrderCard, { type OrderCardData } from '@/components/account/OrderCard';
import OrderFilterChips from '@/components/account/OrderFilterChips';
import { createClient } from '@/lib/supabase/server';
import { getSessionUser } from '@/lib/auth';
import { getDictionary } from '@/i18n';
import type { Locale } from '@/i18n/config';
import type { Order, OrderItem } from '@/lib/supabase/types';

export const dynamic = 'force-dynamic';

type Params = Promise<{ locale: string }>;
type SearchParams = Promise<{ status?: string }>;

const ACTIVE = ['pending', 'processing', 'in_progress', 'partial'];

export default async function AccountOrdersPage({
  params,
  searchParams,
}: {
  params: Params;
  searchParams: SearchParams;
}) {
  const { locale } = await params;
  const { status } = await searchParams;
  const t = getDictionary(locale);
  const l = locale as Locale;

  const user = await getSessionUser();
  if (!user) redirect(`/${l}/login?redirect=/${l}/account/orders`);

  // La RLS restreint déjà à ses propres commandes ; le filtre explicite
  // garde la page personnelle même pour un administrateur.
  const supabase = await createClient();
  const { data } = await supabase
    .from('orders')
    .select('*, order_items ( service_name, quantity )')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false });

  const all = (data ?? []) as unknown as Array<Order & { order_items: OrderItem[] }>;

  const filtered = all.filter((order) => {
    if (status === 'active') return ACTIVE.includes(order.status);
    if (status === 'completed') return order.status === 'completed';
    return true;
  });

  const orders: OrderCardData[] = filtered.map((order) => {
    const items = order.order_items ?? [];
    return {
      id: order.id,
      status: order.status,
      total: Number(order.total),
      created_at: order.created_at,
      service_name: items[0]?.service_name ?? null,
      extra_items: Math.max(0, items.length - 1),
      quantity: items.reduce((sum, i) => sum + Number(i.quantity ?? 0), 0),
    };
  });

  return (
    <div className="cx cx-has-bottomnav">
      <main className="cx-wrap">
        <Link href={`/${l}/account`} className="cx-order__cta" style={{ marginBottom: 14 }}>
          <i className="ion-chevron-left" />
          {t.dashboard.back}
        </Link>

        <header className="cx-greeting" data-motion="head">
          <h1 className="cx-greeting__name">{t.orderHistory.title}</h1>
          <p className="cx-greeting__sub">
            {all.length} {all.length === 1 ? t.orderHistory.orderOne : t.orderHistory.orderMany}
          </p>
        </header>

        <div style={{ marginTop: 16 }}>
          <OrderFilterChips
            locale={l}
            t={t}
            counts={{
              all: all.length,
              active: all.filter((o) => ACTIVE.includes(o.status)).length,
              completed: all.filter((o) => o.status === 'completed').length,
            }}
          />
        </div>

        <div className="cx-stack cx-stack--tight" style={{ marginTop: 14 }}>
          {orders.length === 0 ? (
            <div className="cx-card">
              <div className="cx-empty">
                <span className="cx-empty__icon">
                  <i className="ion-cube" />
                </span>
                <h3>{t.orderHistory.empty}</h3>
                <p>{t.dashboard.emptyText}</p>
                <Link href={`/${l}/services`} className="cx-btn cx-btn--primary cx-btn--auto">
                  {t.dashboard.orderNow}
                </Link>
              </div>
            </div>
          ) : (
            orders.map((order) => <OrderCard key={order.id} order={order} locale={l} t={t} />)
          )}
        </div>
      </main>
    </div>
  );
}
