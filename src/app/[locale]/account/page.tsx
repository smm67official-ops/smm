import Link from 'next/link';
import { redirect } from 'next/navigation';
import OrderCard, { type OrderCardData } from '@/components/account/OrderCard';
import WalletCard from '@/components/wallet/WalletCard';
import { createClient } from '@/lib/supabase/server';
import { getSessionUser } from '@/lib/auth';
import { getDictionary } from '@/i18n';
import { money } from '@/lib/format';
import { buildWhatsAppLink } from '@/lib/whatsapp';
import { getActiveWhatsAppNumber, listPaymentMethods } from '@/lib/settings';
import type { Locale } from '@/i18n/config';
import type { Order, OrderItem } from '@/lib/supabase/types';

export const dynamic = 'force-dynamic';

type Params = Promise<{ locale: string }>;

export default async function AccountPage({ params }: { params: Params }) {
  const { locale } = await params;
  const t = getDictionary(locale);
  const l = locale as Locale;

  const user = await getSessionUser();
  if (!user) redirect(`/${l}/login?redirect=/${l}/account`);

  const supabase = await createClient();
  const { data } = await supabase
    .from('orders')
    .select('*, order_items ( service_name, quantity )')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false });

  const orders = (data ?? []) as unknown as Array<Order & { order_items: OrderItem[] }>;

  // Recharges en attente : sans ce compteur, le client qui vient d'en
  // demander une croit que rien ne s'est passé.
  const { count: pendingTopUps } = await supabase
    .from('topup_requests')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', user.id)
    .eq('status', 'pending');

  const inProgress = orders.filter((o) =>
    ['pending', 'processing', 'in_progress', 'partial'].includes(o.status)
  ).length;
  const completed = orders.filter((o) => o.status === 'completed').length;
  const spent = orders.reduce((sum, o) => sum + Number(o.total ?? 0), 0);

  const recent: OrderCardData[] = orders.slice(0, 3).map((order) => {
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

  const name = user.profile?.full_name || user.profile?.username || user.email.split('@')[0];
  const balance = Number(user.profile?.balance ?? 0);

  const [businessWhatsapp, paymentMethods] = await Promise.all([
    getActiveWhatsAppNumber(),
    listPaymentMethods(),
  ]);

  const supportLink = buildWhatsAppLink(
    businessWhatsapp,
    `${t.support.whatsappIntro} ${name}.`
  );

  return (
    <div className="cx cx-has-bottomnav">
      <main className="cx-wrap">
        {/* 1. Accueil personnalisé */}
        <header className="cx-greeting" data-motion="head">
          <p className="cx-greeting__hello">{t.dashboard.hello}</p>
          <h1 className="cx-greeting__name">{name} 👋</h1>
          <p className="cx-greeting__sub">
            {orders.length === 0
              ? t.dashboard.subFirst
              : t.dashboard.subReturning
                  .replace('{orders}', String(orders.length))
                  .replace('{inProgress}', String(inProgress))}
          </p>
        </header>

        {/*
          Mobile : tout s'empile dans l'ordre de lecture.
          Desktop : le solde et l'action principale passent en colonne
          latérale collante, le suivi des commandes occupe la colonne large.
        */}
        <div className="cx-dash" style={{ marginTop: 16 }}>
          <aside className="cx-dash__side">
            {/* 2. Solde — l'information qui conditionne la commande,
                 avec la recharge à portée immédiate. */}
            <WalletCard
              locale={l}
              t={t}
              businessWhatsapp={businessWhatsapp}
              paymentMethods={paymentMethods}
              balance={balance}
              pending={pendingTopUps ?? 0}
              defaultWhatsapp={user.profile?.phone ?? null}
            />

            {/* 3. Action principale — une seule, évidente */}
            <Link
              href={`/${l}/services`}
              className="cx-btn cx-btn--primary cx-btn--block"
              data-motion="body"
              data-press
              data-hover="raise"
            >
              <i className="ion-bag" />
              {t.dashboard.orderNow}
            </Link>
          </aside>

          <div className="cx-stack cx-dash__main">
          {/* 4. Résumé des commandes */}
          <div className="cx-section-title">
            <h2>{t.dashboard.summary}</h2>
          </div>
          <div className="cx-summary">
            <Link href={`/${l}/account/orders?status=active`} className="cx-summary__item" data-motion="item">
              <span className="cx-summary__value">{inProgress}</span>
              <span className="cx-summary__label">{t.dashboard.inProgress}</span>
            </Link>
            <Link href={`/${l}/account/orders?status=completed`} className="cx-summary__item" data-motion="item">
              <span className="cx-summary__value">{completed}</span>
              <span className="cx-summary__label">{t.dashboard.completed}</span>
            </Link>
            <span className="cx-summary__item" data-motion="item">
              <span className="cx-summary__value">{money(spent)}</span>
              <span className="cx-summary__label">{t.dashboard.totalSpent}</span>
            </span>
          </div>

          {/* 5. Commandes récentes en cartes verticales */}
          <div className="cx-section-title">
            <h2>{t.dashboard.recentOrders}</h2>
            {orders.length > 0 && (
              <Link href={`/${l}/account/orders`}>{t.dashboard.seeAll}</Link>
            )}
          </div>

          {recent.length === 0 ? (
            <div className="cx-card">
              <div className="cx-empty">
                <span className="cx-empty__icon">
                  <i className="ion-bag" />
                </span>
                <h3>{t.dashboard.emptyTitle}</h3>
                <p>{t.dashboard.emptyText}</p>
                <Link href={`/${l}/services`} className="cx-btn cx-btn--primary cx-btn--auto">
                  {t.dashboard.orderNow}
                </Link>
              </div>
            </div>
          ) : (
            <div className="cx-stack cx-stack--tight">
              {recent.map((order) => (
                <OrderCard key={order.id} order={order} locale={l} t={t} />
              ))}
            </div>
          )}

          {/* 6. Actions rapides */}
          <div className="cx-section-title">
            <h2>{t.dashboard.quickActions}</h2>
          </div>
          <div className="cx-quick" data-reveal>
            <Link href={`/${l}/services`} className="cx-quick__item" data-reveal-item data-hover="lift">
              <span className="cx-quick__icon">
                <i className="ion-bag" />
              </span>
              {t.dashboard.browseShop}
            </Link>
            <Link href={`/${l}/account/orders`} className="cx-quick__item" data-reveal-item data-hover="lift">
              <span className="cx-quick__icon">
                <i className="ion-cube" />
              </span>
              {t.orderHistory.title}
            </Link>
            {supportLink && (
              <a
                href={supportLink}
                target="_blank"
                rel="noreferrer noopener"
                className="cx-quick__item cx-quick__item--whatsapp" data-reveal-item data-hover="lift"
              >
                <span className="cx-quick__icon">
                  <i className="ion-social-whatsapp" />
                </span>
                {t.support.contact}
              </a>
            )}
            <Link href={`/${l}/account/profile`} className="cx-quick__item" data-reveal-item data-hover="lift">
              <span className="cx-quick__icon">
                <i className="ion-person" />
              </span>
              {t.dashboard.profile}
            </Link>
          </div>
          </div>
        </div>
      </main>
    </div>
  );
}
