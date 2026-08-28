import { redirect } from 'next/navigation';
import { Icon } from '@/design-system';
import GpFilters from '@/components/admin/GpFilters';
import TablePagination from '@/components/admin/TablePagination';
import AdminServicesTable from '@/components/admin/AdminServicesTable';
import AdminSyncButton from '@/components/admin/AdminSyncButton';
import { requireAdmin } from '@/lib/auth';
import { getGlobalMargin } from '@/lib/settings';
import { listAdminServices } from '@/lib/admin-queries';
import { PLATFORMS } from '@/lib/platforms';

export const dynamic = 'force-dynamic';

type Params = Promise<{ locale: string }>;
type SearchParams = Promise<Record<string, string | string[] | undefined>>;

const first = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);
const PAGE_SIZES = [10, 20, 50, 100];

export default async function AdminServicesPage({
  params,
  searchParams,
}: {
  params: Params;
  searchParams: SearchParams;
}) {
  const auth = await requireAdmin();
  const globalMargin = await getGlobalMargin();
  const { locale } = await params;
  if (!auth.ok) redirect(`/${locale}/admin/login`);

  const sp = await searchParams;
  const page = Math.max(1, Number(first(sp.page) ?? 1) || 1);
  const requested = Number(first(sp.per) ?? 20);
  const perPage = PAGE_SIZES.includes(requested) ? requested : 20;

  const { services, total } = await listAdminServices({
    q: first(sp.q) || undefined,
    platform: first(sp.platform) || 'all',
    status: first(sp.status) || 'all',
    page,
    perPage,
  });

  const basePath = `/${locale}/admin/services`;

  return (
    <div className="gp-page">
      <header className="gp-hero">
        <div className="gp-hero__glow" aria-hidden="true" />
        <div className="gp-hero__main">
          <div className="gp-hero__brand">
            <span className="gp-icon-mark" aria-hidden="true">
              <Icon name="bolt" size={22} />
            </span>
            <div>
              <p className="gp-hero__eyebrow">Catalogue</p>
              <h2 className="gp-hero__title">Services</h2>
              <p className="gp-hero__desc">
                {total.toLocaleString()} service{total === 1 ? '' : 's'} synced from the provider —
                adjust selling price, quantity bounds and availability.
              </p>
            </div>
          </div>
          <div className="gp-hero__actions">
            <AdminSyncButton target="status" label="Refresh statuses" />
            <AdminSyncButton />
          </div>
        </div>
      </header>

      <div className="gp-stage">
        {total === 0 && (
          <div className="gp-card gp-card__inner">
            <p style={{ margin: 0, color: '#64748b' }}>
              Catalogue is empty. Set <code>SMMGEN_API_KEY</code> then press <b>Sync catalogue</b> to
              import the provider services.
            </p>
          </div>
        )}

        <section className="gp-card">
          <GpFilters
            basePath={basePath}
            fields={[
              { type: 'search', name: 'q', label: 'Search', placeholder: 'Service name…' },
              {
                type: 'select',
                name: 'platform',
                label: 'Platform',
                options: [
                  { value: 'all', label: 'All platforms' },
                  ...PLATFORMS.map((platform) => ({ value: platform.slug, label: platform.label })),
                ],
              },
              {
                type: 'select',
                name: 'status',
                label: 'Availability',
                options: [
                  { value: 'all', label: 'All' },
                  { value: 'active', label: 'Active only' },
                  { value: 'inactive', label: 'Disabled only' },
                ],
              },
            ]}
          />

          {services.length === 0 ? (
            <div className="gp-empty">
              <span className="gp-empty__icon">
                <Icon name="bolt" size={22} />
              </span>
              <p style={{ margin: 0 }}>No service matches these filters.</p>
            </div>
          ) : (
            <>
              <AdminServicesTable
            globalMargin={globalMargin} locale={locale} services={services} />
              <TablePagination basePath={basePath} page={page} perPage={perPage} total={total} />
            </>
          )}
        </section>
      </div>
    </div>
  );
}
