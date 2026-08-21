import Link from 'next/link';
import { redirect } from 'next/navigation';
import { Icon } from '@/design-system';
import GpFilters from '@/components/admin/GpFilters';
import TablePagination from '@/components/admin/TablePagination';
import AdminOrdersTable from '@/components/admin/AdminOrdersTable';
import AdminNewOrder from '@/components/admin/AdminNewOrder';
import { requireAdmin } from '@/lib/auth';
import { listOrders, type DateRange } from '@/lib/admin-queries';
import { ORDER_STATUSES, STATUS_LABEL } from '@/lib/orders';

export const dynamic = 'force-dynamic';

type Params = Promise<{ locale: string }>;
type SearchParams = Promise<Record<string, string | string[] | undefined>>;

const first = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);
const PAGE_SIZES = [10, 20, 50, 100];

export default async function AdminOrdersPage({
  params,
  searchParams,
}: {
  params: Params;
  searchParams: SearchParams;
}) {
  const auth = await requireAdmin();
  const { locale } = await params;
  if (!auth.ok) redirect(`/${locale}/admin/login`);

  const sp = await searchParams;
  const page = Math.max(1, Number(first(sp.page) ?? 1) || 1);
  const requested = Number(first(sp.per) ?? 20);
  const perPage = PAGE_SIZES.includes(requested) ? requested : 20;

  const { orders, total } = await listOrders({
    q: first(sp.q) || undefined,
    status: first(sp.status) || 'all',
    range: (first(sp.range) as DateRange) || 'all',
    sort: (first(sp.sort) as 'newest' | 'oldest' | 'amount-desc' | 'amount-asc') || 'newest',
    page,
    perPage,
  });

  const basePath = `/${locale}/admin/orders`;

  return (
    <div className="gp-page">
      <header className="gp-hero">
        <div className="gp-hero__glow" aria-hidden="true" />
        <div className="gp-hero__main">
          <div className="gp-hero__brand">
            <span className="gp-icon-mark" aria-hidden="true">
              <Icon name="wallet" size={22} />
            </span>
            <div>
              <p className="gp-hero__eyebrow">Operations</p>
              <h2 className="gp-hero__title">Orders</h2>
              <p className="gp-hero__desc">
                {total.toLocaleString()} order{total === 1 ? '' : 's'} — search, filter, update the
                status or open the full detail.
              </p>
            </div>
          </div>
          <div className="gp-hero__actions">
            <AdminNewOrder />
          </div>
        </div>
      </header>

      <div className="gp-stage">
        <section className="gp-card">
          <GpFilters
            basePath={basePath}
            fields={[
              { type: 'search', name: 'q', label: 'Search', placeholder: 'Customer name or email…' },
              {
                type: 'select',
                name: 'status',
                label: 'Status',
                options: [
                  { value: 'all', label: 'All statuses' },
                  ...ORDER_STATUSES.map((s) => ({ value: s, label: STATUS_LABEL[s] })),
                ],
              },
              {
                type: 'select',
                name: 'range',
                label: 'Period',
                options: [
                  { value: 'all', label: 'All time' },
                  { value: 'today', label: 'Today' },
                  { value: '7d', label: 'Last 7 days' },
                  { value: '30d', label: 'Last 30 days' },
                ],
              },
              {
                type: 'select',
                name: 'sort',
                label: 'Sort',
                options: [
                  { value: 'newest', label: 'Newest first' },
                  { value: 'oldest', label: 'Oldest first' },
                  { value: 'amount-desc', label: 'Amount: high to low' },
                  { value: 'amount-asc', label: 'Amount: low to high' },
                ],
              },
            ]}
          />

          {orders.length === 0 ? (
            <div className="gp-empty">
              <span className="gp-empty__icon">
                <Icon name="search" size={22} />
              </span>
              <p style={{ margin: 0 }}>No order matches these filters.</p>
              <Link href={basePath} className="gp-btn gp-btn--sm">
                Reset filters
              </Link>
            </div>
          ) : (
            <>
              <AdminOrdersTable locale={locale} orders={orders} />
              <TablePagination basePath={basePath} page={page} perPage={perPage} total={total} />
            </>
          )}
        </section>
      </div>
    </div>
  );
}
