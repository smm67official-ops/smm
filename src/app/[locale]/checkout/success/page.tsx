import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { STATUS_CLASS, statusLabel } from '@/components/account/OrderCard';
import SuccessCheck from '@/components/motion/SuccessCheck';
import { getSessionUser } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { getDictionary } from '@/i18n';
import { money, formatDate } from '@/lib/format';
import { BUSINESS_WHATSAPP, buildWhatsAppLink } from '@/lib/whatsapp';
import type { Locale } from '@/i18n/config';
import type { Order, OrderItem } from '@/lib/supabase/types';

export const dynamic = 'force-dynamic';

type Params = Promise<{ locale: string }>;
type SearchParams = Promise<{ order?: string }>;

export default async function CheckoutSuccessPage({
  params,
  searchParams,
}: {
  params: Params;
  searchParams: SearchParams;
}) {
  const { locale } = await params;
  const { order: orderId } = await searchParams;
  const t = getDictionary(locale);
  const l = locale as Locale;

  const user = await getSessionUser();
  if (!user) redirect(`/${l}/login`);
  if (!orderId) notFound();

  const supabase = await createClient();
  const { data: orderRow } = await supabase
    .from('orders')
    .select('*')
    .eq('id', orderId)
    .eq('user_id', user.id)
    .maybeSingle();

  if (!orderRow) notFound();
  const order = orderRow as Order;

  const { data: itemRows } = await supabase
    .from('order_items')
    .select('*')
    .eq('order_id', order.id)
    .order('created_at');

  const items = (itemRows ?? []) as OrderItem[];

  // L'assistance reste accessible, mais discrète : la commande est déjà
  // passée, rien n'oblige le client à écrire sur WhatsApp.
  const supportLink = buildWhatsAppLink(
    BUSINESS_WHATSAPP,
    `${t.support.orderIntro} #${order.id.slice(0, 8).toUpperCase()}`
  );

  return (
    <div className="cx">
      <main className="cx-wrap">
        <section className="cx-success" data-motion="head">
          <SuccessCheck />
          <h1>🎉 {t.checkout.successTitle}</h1>
          <p>{t.checkout.successLead}</p>
        </section>

        <div className="cx-stack" style={{ marginTop: 24 }}>
          {/* Récapitulatif */}
          <section className="cx-card" data-motion="body">
            <div className="cx-kv">
              <span>{t.checkout.orderNumber}</span>
              <b>#{order.id.slice(0, 8).toUpperCase()}</b>
            </div>
            <div className="cx-kv">
              <span>{t.orderHistory.placedOn}</span>
              <b>{formatDate(order.created_at)}</b>
            </div>
            <div className="cx-kv">
              <span>{t.orderHistory.colStatus}</span>
              <b>
                <span className={`cx-badge ${STATUS_CLASS[order.status] ?? 'cx-badge--pending'}`}>
                  <span className="cx-badge__dot" />
                  {statusLabel(t, order.status)}
                </span>
              </b>
            </div>

            {items.map((item) => (
              <div className="cx-kv" key={item.id}>
                <span style={{ maxWidth: '60%' }}>
                  {item.service_name}
                  <br />
                  <span style={{ fontSize: 11.5, color: '#9ca3af' }}>
                    {t.orderHistory.colQuantity}: {item.quantity.toLocaleString()}
                  </span>
                </span>
                <b>{money(Number(item.charge))}</b>
              </div>
            ))}

            <div className="cx-kv cx-kv--total">
              <span>{t.checkout.paidWithWallet}</span>
              <b>{money(Number(order.total))}</b>
            </div>
          </section>

          {/* Étape suivante — informe sans rien exiger */}
          <section className="cx-card" data-motion="body">
            <h2 style={{ margin: '0 0 14px', fontSize: 15, fontFamily: 'Montserrat, sans-serif' }}>
              {t.checkout.nextSteps}
            </h2>
            <div className="cx-steps">
              <div className="cx-step cx-step--done">
                <span className="cx-step__num">
                  <i className="ion-checkmark" />
                </span>
                <div>
                  <b>{t.checkout.step1}</b>
                  <span>{t.checkout.step1Hint}</span>
                </div>
              </div>
              <div className="cx-step">
                <span className="cx-step__num">2</span>
                <div>
                  <b>{t.checkout.step2}</b>
                  <span>{t.checkout.step2Hint}</span>
                </div>
              </div>
              <div className="cx-step">
                <span className="cx-step__num">3</span>
                <div>
                  <b>{t.checkout.step3}</b>
                  <span>{t.checkout.step3Hint}</span>
                </div>
              </div>
            </div>
          </section>

          {/* Une action principale, une secondaire */}
          <Link href={`/${l}/account/orders/${order.id}`} className="cx-btn cx-btn--primary" data-motion="item" data-press data-hover="raise">
            {t.checkout.viewMyOrder}
            <i className="ion-arrow-right-c" />
          </Link>
          <Link href={`/${l}/services`} className="cx-btn cx-btn--ghost" data-motion="item" data-press>
            {t.checkout.backToShop}
          </Link>

          {/* Assistance : lien texte, pas un appel à l'action */}
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
