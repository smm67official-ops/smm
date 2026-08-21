import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { Badge, Card, CardBody, CardHeader, Icon } from '@/design-system';
import OrderStatusPanel from '@/components/admin/OrderStatusPanel';
import WhatsAppButton from '@/components/shop/WhatsAppButton';
import { requireAdmin } from '@/lib/auth';
import { getOrderDetail } from '@/lib/admin-queries';
import { STATUS_LABEL, STATUS_TONE } from '@/lib/orders';
import { platformOf } from '@/lib/platforms';
import { buildWhatsAppMessage, formatWhatsApp } from '@/lib/whatsapp';
import type { OrderStatus } from '@/lib/supabase/types';

export const dynamic = 'force-dynamic';

type Params = Promise<{ locale: string; id: string }>;

const money = (value: number) => `$${Number(value ?? 0).toFixed(4)}`;
const datetime = (iso?: string | null) =>
  iso ? new Date(iso).toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short' }) : '—';

/** Une URL d'image dans le lien cible est affichée en aperçu. */
const isImageUrl = (url?: string | null) =>
  Boolean(url && /\.(png|jpe?g|gif|webp|avif)(\?|$)/i.test(url));

export default async function AdminOrderDetailPage({ params }: { params: Params }) {
  const auth = await requireAdmin();
  const { locale, id } = await params;
  if (!auth.ok) redirect(`/${locale}/admin/login`);

  const detail = await getOrderDetail(id);
  if (!detail) notFound();

  const { order, items, events, profile, services } = detail;
  const serviceById = new Map(services.map((s) => [s.id, s]));

  // Côté admin, le bouton ouvre la conversation avec LE CLIENT : le
  // destinataire est donc le numéro fourni à la commande, pas celui du panel.
  const whatsappMessage = buildWhatsAppMessage({
    order: {
      id: order.id,
      total: Number(order.total),
      first_name: order.first_name,
      last_name: order.last_name,
      whatsapp: order.whatsapp,
      email: order.email,
    },
    items: items.map((item) => ({
      service_name: item.service_name,
      platform: item.service_id ? (serviceById.get(item.service_id)?.platform ?? null) : null,
      link: item.link,
      quantity: item.quantity,
      charge: Number(item.charge),
      extras: item.extras,
    })),
  });

  return (
    <>
      <header className="gp-hero">
        <div className="gp-hero__glow" aria-hidden="true" />
        <div className="gp-hero__main">
          <div className="gp-hero__brand">
            <span className="gp-icon-mark" aria-hidden="true">
              <Icon name="wallet" size={22} />
            </span>
            <div>
              <Link href={`/${locale}/admin/orders`} className="gp-hero__eyebrow">
                ← Back to orders
              </Link>
              <h2 className="gp-hero__title">Order #{order.id.slice(0, 8)}</h2>
              <p className="gp-hero__desc">
                Created {datetime(order.created_at)} · updated {datetime(order.updated_at)}
              </p>
            </div>
          </div>
          <div className="gp-hero__actions">
            <Badge tone={STATUS_TONE[order.status as OrderStatus] ?? 'neutral'}>
              {STATUS_LABEL[order.status as OrderStatus] ?? order.status}
            </Badge>
          </div>
        </div>
      </header>

      {order.provider_error && (
        <div className="sv-alert sv-alert--error" style={{ marginBottom: 'var(--sv-space-6)' }}>
          <span className="sv-alert__icon">
            <Icon name="alert" size={18} />
          </span>
          <div>
            <p className="sv-alert__title">Provider error</p>
            <p className="sv-alert__body">{order.provider_error}</p>
          </div>
        </div>
      )}

      <div className="sv-detail-grid">
        <div className="sv-stack" style={{ gap: 'var(--sv-space-6)' }}>
          {/* ---------- Lignes de commande ---------- */}
          <Card>
            <CardHeader title="Items" subtitle={`${items.length} line(s)`} />
            <CardBody style={{ padding: 0 }}>
              {items.map((item) => {
                const service = item.service_id ? serviceById.get(item.service_id) : undefined;
                const platform = platformOf(service?.platform);

                return (
                  <div
                    key={item.id}
                    style={{
                      padding: 'var(--sv-space-6)',
                      borderBottom: '1px solid var(--sv-border)',
                    }}
                  >
                    <div className="sv-row" style={{ marginBottom: 'var(--sv-space-4)' }}>
                      {platform && (
                        <span className="sv-account__platform" style={{ ['--sv-platform' as string]: platform.color }}>
                          <Icon name="users" size={16} />
                        </span>
                      )}
                      <div style={{ minWidth: 0 }}>
                        <div className="sv-table__strong">{item.service_name}</div>
                        <div className="sv-caption">
                          {service?.category_name ?? 'Category unavailable'} · provider service{' '}
                          {item.provider_service_id ?? '—'}
                        </div>
                      </div>
                      <div style={{ marginInlineStart: 'auto' }}>
                        <Badge tone={STATUS_TONE[item.status as OrderStatus] ?? 'neutral'}>
                          {STATUS_LABEL[item.status as OrderStatus] ?? item.status}
                        </Badge>
                      </div>
                    </div>

                    <dl className="sv-deflist">
                      <dt>Quantity</dt>
                      <dd>{item.quantity.toLocaleString()}</dd>

                      <dt>Rate / 1000</dt>
                      <dd>{money(item.rate)}</dd>

                      <dt>Charge</dt>
                      <dd className="sv-table__strong">{money(item.charge)}</dd>

                      <dt>Target</dt>
                      <dd>
                        {item.link ? (
                          <a href={item.link} target="_blank" rel="noreferrer noopener">
                            {item.link}
                          </a>
                        ) : (
                          '—'
                        )}
                      </dd>

                      <dt>Provider order</dt>
                      <dd>{item.provider_order_id ?? 'Not submitted'}</dd>

                      <dt>Start count</dt>
                      <dd>{item.start_count ?? '—'}</dd>

                      <dt>Remains</dt>
                      <dd>{item.remains ?? '—'}</dd>

                      <dt>Last sync</dt>
                      <dd>{datetime(item.synced_at)}</dd>
                    </dl>

                    {item.provider_error && (
                      <p className="sv-error-text" style={{ marginTop: 'var(--sv-space-3)' }}>
                        {item.provider_error}
                      </p>
                    )}

                    {isImageUrl(item.link) && (
                      <div style={{ marginTop: 'var(--sv-space-4)' }}>
                        <span className="sv-caption">Target preview</span>
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={item.link as string}
                          alt="Order target"
                          style={{
                            display: 'block',
                            marginTop: 'var(--sv-space-2)',
                            maxWidth: 320,
                            borderRadius: 'var(--sv-radius-md)',
                            border: '1px solid var(--sv-border)',
                          }}
                        />
                      </div>
                    )}

                    {Object.keys(item.extras ?? {}).length > 0 && (
                      <details style={{ marginTop: 'var(--sv-space-4)' }}>
                        <summary className="sv-caption">Extra provider fields</summary>
                        <pre className="sv-codeblock" style={{ marginTop: 'var(--sv-space-2)' }}>
                          {JSON.stringify(item.extras, null, 2)}
                        </pre>
                      </details>
                    )}
                  </div>
                );
              })}
            </CardBody>
          </Card>

          {/* ---------- Historique ---------- */}
          <Card>
            <CardHeader title="Status history" subtitle={`${events.length} event(s)`} />
            <CardBody>
              {events.length === 0 ? (
                <p className="sv-caption" style={{ margin: 0 }}>No status change recorded yet.</p>
              ) : (
                <div className="sv-timeline">
                  {events.map((event) => (
                    <div className="sv-timeline__item" key={event.id}>
                      <div style={{ flex: 1 }}>
                        <div className="sv-table__strong" style={{ fontSize: 'var(--sv-text-sm)' }}>
                          {event.from_status ? `${event.from_status} → ` : ''}
                          {event.to_status}
                        </div>
                        <div className="sv-caption">
                          {datetime(event.created_at)} · {event.source}
                          {event.note ? ` · ${event.note}` : ''}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardBody>
          </Card>
        </div>

        {/* ---------- Colonne latérale ---------- */}
        <div className="sv-stack" style={{ gap: 'var(--sv-space-6)' }}>
          <OrderStatusPanel orderId={order.id} currentStatus={order.status} />

          <Card>
            <CardHeader title="Customer" />
            <CardBody>
              <dl className="sv-deflist">
                <dt>Name</dt>
                <dd>{[order.first_name, order.last_name].filter(Boolean).join(' ') || '—'}</dd>

                <dt>Email</dt>
                <dd>{order.email}</dd>

                <dt>Phone</dt>
                <dd>{order.phone || '—'}</dd>

                <dt>Country</dt>
                <dd>{order.country || '—'}</dd>

                <dt>Account</dt>
                <dd>
                  {profile ? (
                    <Link href={`/${locale}/admin/customers?q=${encodeURIComponent(profile.username ?? '')}`}>
                      {profile.username ?? profile.id.slice(0, 8)}
                    </Link>
                  ) : (
                    'Guest'
                  )}
                </dd>

                <dt>WhatsApp</dt>
                <dd>{order.whatsapp ? formatWhatsApp(order.whatsapp) : '—'}</dd>

                <dt>Wallet balance</dt>
                <dd>{profile ? money(profile.balance) : '—'}</dd>
              </dl>

              {order.whatsapp && (
                <div style={{ marginTop: 'var(--sv-space-5)' }}>
                  <WhatsAppButton
                    orderId={order.id}
                    phone={order.whatsapp}
                    message={whatsappMessage}
                    label="Contact on WhatsApp"
                    variant="outline"
                    block
                  />
                </div>
              )}
            </CardBody>
          </Card>

          <Card>
            <CardHeader title="Payment & provider" />
            <CardBody>
              <dl className="sv-deflist">
                <dt>Total</dt>
                <dd className="sv-table__strong">{money(order.total)}</dd>

                <dt>Note</dt>
                <dd>{order.note || '—'}</dd>

                <dt>Submitted at</dt>
                <dd>{datetime(order.submitted_at)}</dd>

                <dt>Idempotency</dt>
                <dd className="sv-caption">{order.idempotency_key ?? '—'}</dd>
              </dl>
            </CardBody>
          </Card>
        </div>
      </div>
    </>
  );
}
