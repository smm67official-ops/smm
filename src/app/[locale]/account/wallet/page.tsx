import Link from 'next/link';
import { redirect } from 'next/navigation';
import WalletCard from '@/components/wallet/WalletCard';
import { getSessionUser } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { getDictionary } from '@/i18n';
import { money, formatDate } from '@/lib/format';
import type { Locale } from '@/i18n/config';
import type { TopUpRequest, TopUpStatus, WalletTransaction } from '@/lib/supabase/types';

export const dynamic = 'force-dynamic';

type Params = Promise<{ locale: string }>;

const STATUS_BADGE: Record<TopUpStatus, string> = {
  pending: 'cx-badge--pending',
  approved: 'cx-badge--completed',
  rejected: 'cx-badge--failed',
  canceled: 'cx-badge--canceled',
};

export default async function WalletPage({ params }: { params: Params }) {
  const { locale } = await params;
  const t = getDictionary(locale);
  const l = locale as Locale;

  const user = await getSessionUser();
  if (!user) redirect(`/${l}/login?redirect=/${l}/account/wallet`);

  // La RLS restreint déjà la lecture au propriétaire du portefeuille.
  const supabase = await createClient();

  const [{ data: txData }, { data: topupData }] = await Promise.all([
    supabase
      .from('wallet_transactions')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(100),
    supabase
      .from('topup_requests')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(10),
  ]);

  const transactions = (txData ?? []) as WalletTransaction[];
  const topups = (topupData ?? []) as TopUpRequest[];
  const pending = topups.filter((r) => r.status === 'pending').length;
  const balance = Number(user.profile?.balance ?? 0);

  const statusLabel: Record<TopUpStatus, string> = {
    pending: t.topup.statusPending,
    approved: t.topup.statusApproved,
    rejected: t.topup.statusRejected,
    canceled: t.topup.statusCanceled,
  };

  return (
    <div className="cx cx-has-bottomnav">
      <main className="cx-wrap cx-wrap--narrow">
        <Link
          href={`/${l}/account`}
          className="cx-order__cta"
          style={{ marginBottom: 14 }}
          data-motion="head"
        >
          <i className="ion-chevron-left" />
          {t.dashboard.back}
        </Link>

        <header className="cx-greeting" data-motion="head">
          <h1 className="cx-greeting__name">{t.wallet.cardTitle}</h1>
          <p className="cx-greeting__sub">{t.wallet.subtitle}</p>
        </header>

        <div className="cx-stack" style={{ marginTop: 16 }}>
          <WalletCard
            locale={l}
            t={t}
            balance={balance}
            pending={pending}
            showHistoryLink={false}
            defaultWhatsapp={user.profile?.phone ?? null}
          />

          {/* Demandes de recharge : l'état d'une demande doit être visible
              dans la plateforme, pas seulement dans une conversation. */}
          {topups.length > 0 && (
            <>
              <div className="cx-section-title">
                <h2>{t.wallet.requests}</h2>
              </div>

              <div className="cx-stack cx-stack--tight" data-reveal>
                {topups.map((request) => (
                  <article className="cx-card" key={request.id} data-reveal-item>
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        gap: 12,
                      }}
                    >
                      <div style={{ minWidth: 0 }}>
                        <b className="cx-order__price">{money(Number(request.amount))}</b>
                        <p className="cx-order__meta" style={{ margin: '2px 0 0' }}>
                          #{request.id.slice(0, 8).toUpperCase()} · {formatDate(request.created_at)}
                        </p>
                      </div>
                      <span className={`cx-badge ${STATUS_BADGE[request.status]}`}>
                        <span className="cx-badge__dot" />
                        {statusLabel[request.status]}
                      </span>
                    </div>
                  </article>
                ))}
              </div>
            </>
          )}

          <div className="cx-section-title">
            <h2>{t.wallet.history}</h2>
          </div>

          {transactions.length === 0 ? (
            <div className="cx-card" data-motion="body">
              <div className="cx-empty">
                <span className="cx-empty__icon">
                  <i className="ion-card" />
                </span>
                <h3>{t.wallet.empty}</h3>
                <p>{t.wallet.subtitle}</p>
              </div>
            </div>
          ) : (
            /* Une ligne = une carte : aucun tableau à faire défiler au pouce. */
            <div className="cx-stack cx-stack--tight" data-reveal>
              {transactions.map((tx) => {
                const amount = Number(tx.amount);
                const credit = amount >= 0;
                return (
                  <article className="cx-card" key={tx.id} data-reveal-item>
                    <div className="cx-order__top" style={{ marginBottom: 0 }}>
                      <span
                        className="cx-order__icon"
                        style={
                          credit
                            ? { background: '#eafaf0', color: '#15803d' }
                            : { background: '#fdecec', color: '#b91c1c' }
                        }
                      >
                        <i className={credit ? 'ion-arrow-down-c' : 'ion-arrow-up-c'} />
                      </span>

                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div
                          style={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            gap: 12,
                            alignItems: 'baseline',
                          }}
                        >
                          <h3 className="cx-order__title" style={{ textTransform: 'capitalize' }}>
                            {tx.type}
                          </h3>
                          <span
                            className="cx-order__price"
                            style={{ color: credit ? '#15803d' : '#b91c1c', whiteSpace: 'nowrap' }}
                          >
                            {credit ? '+' : ''}
                            {money(amount)}
                          </span>
                        </div>

                        <p className="cx-order__meta">
                          {formatDate(tx.created_at)} · {t.wallet.colBalance}{' '}
                          {money(Number(tx.balance_after))}
                        </p>

                        {(tx.reason || tx.order_id) && (
                          <p className="cx-order__meta" style={{ marginTop: 6 }}>
                            {tx.reason ?? ''}
                            {tx.order_id && (
                              <>
                                {tx.reason ? ' · ' : ''}
                                <Link href={`/${l}/account/orders/${tx.order_id}`}>
                                  {t.wallet.order} #{tx.order_id.slice(0, 8)}
                                </Link>
                              </>
                            )}
                          </p>
                        )}
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
