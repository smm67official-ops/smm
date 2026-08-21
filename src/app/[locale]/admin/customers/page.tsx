import { redirect } from 'next/navigation';
import { Icon } from '@/design-system';
import GpFilters from '@/components/admin/GpFilters';
import TablePagination from '@/components/admin/TablePagination';
import AdminCustomersTable from '@/components/admin/AdminCustomersTable';
import { requireAdmin } from '@/lib/auth';
import { listCustomers } from '@/lib/admin-queries';

export const dynamic = 'force-dynamic';

type Params = Promise<{ locale: string }>;
type SearchParams = Promise<Record<string, string | string[] | undefined>>;

const first = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);
const PAGE_SIZES = [10, 20, 50, 100];

export default async function AdminCustomersPage({
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

  const { customers, total } = await listCustomers({
    q: first(sp.q) || undefined,
    role: first(sp.role) || 'all',
    page,
    perPage,
  });

  const basePath = `/${locale}/admin/customers`;
  const walletTotal = customers.reduce((sum, c) => sum + Number(c.balance ?? 0), 0);

  return (
    <div className="gp-page">
      <header className="gp-hero">
        <div className="gp-hero__glow" aria-hidden="true" />
        <div className="gp-hero__main">
          <div className="gp-hero__brand">
            <span className="gp-icon-mark" aria-hidden="true">
              <Icon name="users" size={22} />
            </span>
            <div>
              <p className="gp-hero__eyebrow">Directory</p>
              <h2 className="gp-hero__title">Customers</h2>
              <p className="gp-hero__desc">
                {total.toLocaleString()} account{total === 1 ? '' : 's'} — create, edit, manage
                wallets and roles.
              </p>
            </div>
          </div>
          <div className="gp-hero__actions">
            <span className="gp-pill gp-pill--brand">
              <Icon name="card" size={13} />${walletTotal.toFixed(2)} on this page
            </span>
          </div>
        </div>
      </header>

      <div className="gp-stage">
        <section className="gp-card">
          <GpFilters
            basePath={basePath}
            fields={[
              { type: 'search', name: 'q', label: 'Search', placeholder: 'Username or full name…' },
              {
                type: 'select',
                name: 'role',
                label: 'Role',
                options: [
                  { value: 'all', label: 'All roles' },
                  { value: 'customer', label: 'Customer' },
                  { value: 'support', label: 'Support' },
                  { value: 'admin', label: 'Admin' },
                ],
              },
            ]}
          />

          {customers.length === 0 ? (
            <div className="gp-empty">
              <span className="gp-empty__icon">
                <Icon name="users" size={22} />
              </span>
              <p style={{ margin: 0 }}>No customer matches these filters.</p>
            </div>
          ) : (
            <>
              <AdminCustomersTable
                locale={locale}
                customers={customers}
                currentUserId={auth.user.id}
              />
              <TablePagination basePath={basePath} page={page} perPage={perPage} total={total} />
            </>
          )}
        </section>
      </div>
    </div>
  );
}
