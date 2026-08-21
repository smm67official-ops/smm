import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { STATUS_CLASS, statusLabel } from '@/components/account/OrderCard';
import ActionNeededCard from '@/components/ui/ActionNeededCard';
import { createClient } from '@/lib/supabase/server';
import { getSessionUser } from '@/lib/auth';
import { getDictionary } from '@/i18n';
import { money, formatDate } from '@/lib/format';
import { BUSINESS_WHATSAPP, buildWhatsAppLink, formatWhatsApp } from '@/lib/whatsapp';
import type { Locale } from '@/i18n/config';
import type { Order, OrderEvent, OrderItem } from '@/lib/supabase/types';

export const dynamic = 'force-dynamic';

type Params = Promise<{ locale: string; id: string }>;

export default async function CustomerOrderDetailPage({ params }: { params: Params }) {
  const { locale, id } = await params;
  const t = getDictionary(locale);
  const l = locale as Locale;

  const user = await getSessionUser();
  if (!user) redirect(`/${l}/login?redirect=/${l}/account/orders/${id}`);

  const supabase = await createClient();

  /**
   * Double filtre : la RLS interdit déjà la commande d'autrui, et le
   * `.eq('user_id')` garde la page personnelle même pour un admin.
   */
  const { data: orderRow } = await supabase
    .from('orders')
    .select('*')
    .eq('id', id)
    .eq('user_id', user.id)
    .maybeSingle();

  if (!orderRow) notFound();
  const order = orderRow as Order;

  const [{ data: itemRows }, { data: eventRows }] = await Promise.all([
    supabase.from('order_items').select('*').eq('order_id', id).order('created_at'),
    supabase.from('order_events').select('*').eq('order_id', id).order('created_at', { ascending: false }),
  ]);

  const items = (itemRows ?? []) as OrderItem[];
  const events = (eventRows ?? []) as OrderEvent[];

  // Un lien cible manquant empêche le traitement : on le signale par une
  // action claire plutôt que par un message d'erreur.
  const missingTarget = items.filter((item) => !item.link);

  const supportLink = buildWhatsAppLink(
    BUSINESS_WHATSAPP,
    `${t.support.orderIntro} #${order.id.slice(0, 8).toUpperCase()}`
  );

  const completeLink = buildWhatsAppLink(
    BUSINESS_WHATSAPP,
    `${t.support.completeIntro} #${order.id.slice(0, 8).toUpperCase()}`
  );

  return (
    <div className="cx cx-has-bottomnav">
      <main className="cx-wrap">
        <Link href={`/${l}/account/orders`} className="cx-order__cta" style={{ marginBottom: 14 }}>
          <i className="ion-chevron-left" />
          {t.orderHistory.title}
        </Link>

        <header className="cx-greeting" data-motion="head">
          <p className="cx-greeting__hello">#{order.id.slice(0, 8).toUpperCase()}</p>
          <h1 className="cx-greeting__name">{money(Number(order.total))}</h1>
          <p style={{ marginTop: 8 }}>
            <span className={`cx-badge ${STATUS_CLASS[order.status] ?? 'cx-badge--pending'}`}>
              <span className="cx-badge__dot" />
              {statusLabel(t, order.status)}
            </span>
          </p>
        </header>

        <div className="cx-stack" style={{ marginTop: 16 }}>
          {/* Information manquante : action, pas erreur */}
          {missingTarget.length > 0 && (
            <ActionNeededCard
              title={t.missing.title}
              description={t.missing.description}
              items={missingTarget.map((item) => ({ label: item.service_name }))}
              whatsappLabel={t.missing.completeOnWhatsapp}
              whatsappHref={completeLink}
            />
          )}

          {/* Lignes de la commande */}
          {items.map((item) => (
            <section className="cx-card" key={item.id}>
              <h2 style={{ margin: '0 0 12px', fontSize: 14.5, fontWeight: 700 }}>
                {item.service_name}
              </h2>

              <div className="cx-kv">
                <span>{t.orderHistory.colQuantity}</span>
                <b>{item.quantity.toLocaleString()}</b>
              </div>
              <div className="cx-kv">
                <span>{t.orderHistory.target}</span>
                <b style={{ maxWidth: '60%', wordBreak: 'break-all' }}>
                  {item.link ? (
                    <a href={item.link} target="_blank" rel="noreferrer noopener">
                      {item.link}
                    </a>
                  ) : (
                    '—'
                  )}
                </b>
              </div>
              {item.start_count !== null && (
                <div className="cx-kv">
                  <span>{t.orderHistory.startCount}</span>
                  <b>{item.start_count}</b>
                </div>
              )}
              {item.remains !== null && (
                <div className="cx-kv">
                  <span>{t.orderHistory.remains}</span>
                  <b>{item.remains}</b>
                </div>
              )}
              <div className="cx-kv">
                <span>{t.orderHistory.charge}</span>
                <b>{money(Number(item.charge))}</b>
              </div>
            </section>
          ))}

          {/* Suivi */}
          <section className="cx-card">
            <h2 style={{ margin: '0 0 14px', fontSize: 15, fontFamily: 'Montserrat, sans-serif' }}>
              {t.orderHistory.history}
            </h2>

            {events.length === 0 ? (
              <p style={{ margin: 0, fontSize: 13.5, color: '#6b7280' }}>
                {t.orderHistory.noHistory}
              </p>
            ) : (
              <div className="cx-steps">
                {events.map((event, index) => (
                  <div className={`cx-step${index === 0 ? ' cx-step--done' : ''}`} key={event.id}>
                    <span className="cx-step__num">
                      {index === 0 ? <i className="ion-checkmark" /> : events.length - index}
                    </span>
                    <div>
                      <b>{statusLabel(t, event.to_status)}</b>
                      <span>{formatDate(event.created_at)}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {order.whatsapp && (
              <div className="cx-kv" style={{ marginTop: 14 }}>
                <span>{t.checkout.whatsapp}</span>
                <b>{formatWhatsApp(order.whatsapp)}</b>
              </div>
            )}
          </section>

          <Link href={`/${l}/services`} className="cx-btn cx-btn--primary">
            {t.checkout.backToShop}
          </Link>

          {supportLink && (
            <p className="cx-help">
              {t.support.needHelp}
              <a href={supportLink} target="_blank" rel="noreferrer noopener">
                <i className="ion-social-whatsapp" />
                {t.support.contact}
              </a>
            </p>
          )}
        </div>
      </main>
    </div>
  );
}
