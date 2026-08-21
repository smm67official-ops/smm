import Link from 'next/link';
import { redirect } from 'next/navigation';
import { Icon, type IconName } from '@/design-system';
import AreaChart from '@/components/admin/charts/AreaChart';
import DonutChart from '@/components/admin/charts/DonutChart';
import ProviderBalanceCard from '@/components/admin/ProviderBalanceCard';
import { requireAdmin } from '@/lib/auth';
import { getAdminStats, getDailyVolume, getRecentOrders, type DateRange } from '@/lib/admin-queries';
import { STATUS_LABEL } from '@/lib/orders';
import type { OrderStatus } from '@/lib/supabase/types';

export const dynamic = 'force-dynamic';

type Params = Promise<{ locale: string }>;
type SearchParams = Promise<{ range?: string }>;

const RANGES: Array<{ id: DateRange; label: string }> = [
  { id: 'today', label: 'Today' },
  { id: '7d', label: '7 days' },
  { id: '30d', label: '30 days' },
  { id: 'all', label: 'All time' },
];

const money = (value: number) => `$${Number(value ?? 0).toFixed(2)}`;
const compact = (value: number) =>
  new Intl.NumberFormat('en', { notation: 'compact', maximumFractionDigits: 1 }).format(value);

const STATUS_PILL: Record<string, string> = {
  pending: 'gp-pill--warning',
  processing: 'gp-pill--info',
  in_progress: 'gp-pill--info',
  completed: 'gp-pill--success',
  partial: 'gp-pill--warning',
  canceled: 'gp-pill--neutral',
  failed: 'gp-pill--danger',
  refunded: 'gp-pill--neutral',
};

function StatCard({
  label,
  value,
  hint,
  icon,
  tone,
}: {
  label: string;
  value: string | number;
  hint?: string;
  icon: IconName;
  tone: 'blue' | 'green' | 'rose' | 'amber' | 'violet' | 'indigo' | 'pink';
}) {
  return (
    <article className="gp-stat-card" data-reveal-item data-hover="lift">
      <span className={`gp-icon-mark gp-icon-mark--stat gp-icon-mark--${tone}`} aria-hidden="true">
        <Icon name={icon} size={19} />
      </span>
      <div className="gp-stat-card__body">
        <p className="gp-stat-card__label">{label}</p>
        <p className="gp-stat-card__value">{value}</p>
        {hint && <p className="gp-stat-card__hint">{hint}</p>}
      </div>
    </article>
  );
}

export default async function AdminDashboardPage({
  params,
  searchParams,
}: {
  params: Params;
  searchParams: SearchParams;
}) {
  const auth = await requireAdmin();
  const { locale } = await params;
  if (!auth.ok) redirect(`/${locale}/admin/login`);

  const { range: rawRange } = await searchParams;
  const range = (RANGES.find((r) => r.id === rawRange)?.id ?? 'all') as DateRange;

  const [stats, recent, volume] = await Promise.all([
    getAdminStats(range),
    getRecentOrders(8),
    getDailyVolume('30d'),
  ]);

  const donut = [
    { label: 'Completed', value: stats.completed, color: '#16a34a' },
    { label: 'In progress', value: stats.processing, color: '#2563eb' },
    { label: 'Pending', value: stats.pending, color: '#f2ba59' },
    { label: 'Partial', value: stats.partial, color: '#7c3aed' },
    { label: 'Cancelled', value: stats.canceled, color: '#94a3b8' },
    { label: 'Failed', value: stats.failed, color: '#e11d48' },
  ].filter((slice) => slice.value > 0);

  return (
    <div className="gp-page">
      {/* ---------- Bandeau ---------- */}
      <header className="gp-hero">
        <div className="gp-hero__glow" aria-hidden="true" />
        <div className="gp-hero__main">
          <div className="gp-hero__brand">
            <span className="gp-icon-mark" aria-hidden="true">
              <Icon name="trendingUp" size={22} />
            </span>
            <div>
              <p className="gp-hero__eyebrow">Overview</p>
              <h2 className="gp-hero__title">Dashboard</h2>
              <p className="gp-hero__desc">
                Live figures read from Supabase — orders, revenue, customers and provider catalogue.
              </p>
            </div>
          </div>

          <div className="gp-hero__actions">
            {RANGES.map((item) => (
              <Link
                key={item.id}
                href={`/${locale}/admin?range=${item.id}`}
                className={`gp-btn gp-btn--sm${range === item.id ? ' gp-btn--primary' : ''}`}
              >
                {item.label}
              </Link>
            ))}
          </div>
        </div>
      </header>

      <div className="gp-stage">
        {/* ---------- Indicateurs ---------- */}
        <div className="gp-stat-grid" data-reveal>
          <StatCard
            label="Total orders"
            value={compact(stats.totalOrders)}
            hint={`${stats.processing} in progress`}
            icon="wallet"
            tone="blue"
          />
          <StatCard
            label="Revenue"
            value={money(stats.revenue)}
            hint={`${money(stats.completedRevenue)} confirmed`}
            icon="trendingUp"
            tone="green"
          />
          <StatCard
            label="Customers"
            value={compact(stats.customers)}
            hint={`${stats.admins} staff account${stats.admins === 1 ? '' : 's'}`}
            icon="users"
            tone="violet"
          />
          <StatCard
            label="Active services"
            value={compact(stats.services)}
            hint="Synced from provider"
            icon="bolt"
            tone="amber"
          />
        </div>

        <div className="gp-stat-grid gp-stat-grid--3" data-reveal>
          <StatCard
            label="Confirmed amount"
            value={money(stats.completedRevenue)}
            hint={`${stats.completed} completed order${stats.completed === 1 ? '' : 's'}`}
            icon="check"
            tone="green"
          />
          <StatCard
            label="Pending amount"
            value={money(stats.pendingRevenue)}
            hint={`${stats.pending} awaiting processing`}
            icon="info"
            tone="amber"
          />
          <StatCard
            label="Customer wallets"
            value={money(stats.walletTotal)}
            hint={`held by ${stats.walletHolders} customer${stats.walletHolders === 1 ? '' : 's'}`}
            icon="card"
            tone="indigo"
          />
        </div>

        {/* ---------- Graphiques ---------- */}
        <div className="gp-grid-2-1" data-reveal>
          <section className="gp-card" data-reveal-item>
            <header className="gp-card-head">
              <div>
                <p className="gp-card-head__eyebrow">Analytics</p>
                <h3 className="gp-card-head__title">Order volume — last 30 days</h3>
                <p className="gp-card-head__desc">Total charged per day</p>
              </div>
            </header>
            <div className="gp-card__inner">
              <AreaChart
                points={volume.map((v) => ({
                  label: new Date(v.day).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' }),
                  value: v.total,
                }))}
                unit="currency"
              />
            </div>
          </section>

          <section className="gp-card" data-reveal-item>
            <header className="gp-card-head">
              <div>
                <p className="gp-card-head__eyebrow">Breakdown</p>
                <h3 className="gp-card-head__title">Orders by status</h3>
              </div>
            </header>
            <div className="gp-card__inner">
              {donut.length === 0 ? (
                <div className="gp-empty">
                  <span className="gp-empty__icon">
                    <Icon name="grid" size={22} />
                  </span>
                  <p style={{ margin: 0 }}>No order yet.</p>
                </div>
              ) : (
                <DonutChart slices={donut} centerLabel="orders" />
              )}
            </div>
          </section>
        </div>

        {/* ---------- Soldes ---------- */}
        <div className="gp-grid-2" data-reveal>
          <ProviderBalanceCard autoSubmit={process.env.SMM_AUTO_SUBMIT === 'true'} />

          <section className="gp-card" data-reveal-item>
            <header className="gp-card-head">
              <div>
                <p className="gp-card-head__eyebrow">Filter</p>
                <h3 className="gp-card-head__title">Jump to a status</h3>
                <p className="gp-card-head__desc">Opens the order list already filtered</p>
              </div>
            </header>
            <div className="gp-card__inner">
              <div className="gp-chips">
                {(
                  [
                    ['pending', stats.pending],
                    ['processing', stats.processing],
                    ['completed', stats.completed],
                    ['partial', stats.partial],
                    ['canceled', stats.canceled],
                    ['failed', stats.failed],
                  ] as Array<[OrderStatus, number]>
                ).map(([status, count]) => (
                  <Link
                    key={status}
                    href={`/${locale}/admin/orders?status=${status}&range=${range}`}
                    className={`gp-pill ${STATUS_PILL[status]}`}
                  >
                    <span className="gp-pill__dot" />
                    {STATUS_LABEL[status]}
                    <b>{count}</b>
                  </Link>
                ))}
              </div>
            </div>
          </section>
        </div>

        {/* ---------- Dernières commandes ---------- */}
        <section className="gp-card" data-reveal-item>
          <header className="gp-card-head">
            <div>
              <p className="gp-card-head__eyebrow">Activity</p>
              <h3 className="gp-card-head__title">Recent orders</h3>
              <p className="gp-card-head__desc">Latest 8 orders, all statuses</p>
            </div>
            <Link href={`/${locale}/admin/orders`} className="gp-btn gp-btn--sm">
              View all
              <Icon name="arrowRight" size={14} />
            </Link>
          </header>

          {recent.length === 0 ? (
            <div className="gp-empty">
              <span className="gp-empty__icon">
                <Icon name="wallet" size={22} />
              </span>
              <p style={{ margin: 0 }}>No orders yet.</p>
            </div>
          ) : (
            <div className="gp-table-wrap">
              <table className="gp-table rs-table">
                <thead>
                  <tr>
                    <th>Order</th>
                    <th>Customer</th>
                    <th>Status</th>
                    <th>Created</th>
                    <th className="gp-table__num">Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {recent.map((order) => (
                    <tr key={order.id}>
                      <td data-label="Order">
                        <Link href={`/${locale}/admin/orders/${order.id}`} className="gp-table__strong">
                          #{order.id.slice(0, 8)}
                        </Link>
                      </td>
                      <td data-label="Customer" className="rs-cell--head">
                        <div className="gp-cell-stack">
                          <span className="gp-avatar">
                            {(order.first_name ?? order.email).slice(0, 2).toUpperCase()}
                          </span>
                          <span style={{ minWidth: 0 }}>
                            <span className="gp-table__strong" style={{ display: 'block' }}>
                              {[order.first_name, order.last_name].filter(Boolean).join(' ') || '—'}
                            </span>
                            <span className="gp-table__muted">{order.email}</span>
                          </span>
                        </div>
                      </td>
                      <td data-label="Status">
                        <span className={`gp-pill ${STATUS_PILL[order.status] ?? 'gp-pill--neutral'}`}>
                          <span className="gp-pill__dot" />
                          {STATUS_LABEL[order.status as OrderStatus] ?? order.status}
                        </span>
                      </td>
                      <td className="gp-table__muted" data-label="Created">
                        {new Date(order.created_at).toLocaleString('en-GB', {
                          dateStyle: 'medium',
                          timeStyle: 'short',
                        })}
                      </td>
                      <td className="gp-table__num gp-table__strong" data-label="Amount">{money(order.total)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
