import Link from 'next/link';
import { redirect } from 'next/navigation';
import { Icon } from '@/design-system';
import AdminTopUpsTable from '@/components/admin/AdminTopUpsTable';
import { requireAdmin } from '@/lib/auth';
import { listAdminTopUpRequests } from '@/lib/topup';

export const dynamic = 'force-dynamic';

type Params = Promise<{ locale: string }>;
type SearchParams = Promise<{ status?: string }>;

const money = (value: number) => `$${Number(value ?? 0).toFixed(2)}`;

export default async function AdminTopUpsPage({
  params,
  searchParams,
}: {
  params: Params;
  searchParams: SearchParams;
}) {
  const auth = await requireAdmin();
  const { locale } = await params;
  if (!auth.ok) redirect(`/${locale}/admin/login`);

  const { status } = await searchParams;
  const filter = status === 'all' ? 'all' : 'pending';

  const requests = await listAdminTopUpRequests(filter);
  const pendingTotal = requests
    .filter((r) => r.status === 'pending')
    .reduce((sum, r) => sum + Number(r.amount), 0);

  return (
    <div className="gp-page">
      <header className="gp-hero">
        <div className="gp-hero__glow" aria-hidden="true" />
        <div className="gp-hero__main">
          <div className="gp-hero__brand">
            <span className="gp-icon-mark" aria-hidden="true">
              <Icon name="card" size={22} />
            </span>
            <div>
              <p className="gp-hero__eyebrow">Wallet</p>
              <h2 className="gp-hero__title">Top-ups</h2>
              <p className="gp-hero__desc">
                Customer top-up requests. Approving credits the wallet through the ledger — the
                balance is never written directly.
              </p>
            </div>
          </div>

          <div className="gp-hero__actions">
            <Link
              href={`/${locale}/admin/topups`}
              className={`gp-btn gp-btn--sm${filter === 'pending' ? ' gp-btn--primary' : ''}`}
            >
              Pending
            </Link>
            <Link
              href={`/${locale}/admin/topups?status=all`}
              className={`gp-btn gp-btn--sm${filter === 'all' ? ' gp-btn--primary' : ''}`}
            >
              All
            </Link>
          </div>
        </div>
      </header>

      <div className="gp-stage">
        <div className="gp-stat-grid gp-stat-grid--3" data-reveal>
          <article className="gp-stat-card" data-reveal-item data-hover="lift">
            <span className="gp-icon-mark gp-icon-mark--stat gp-icon-mark--amber" aria-hidden="true">
              <Icon name="info" size={19} />
            </span>
            <div className="gp-stat-card__body">
              <p className="gp-stat-card__label">Awaiting confirmation</p>
              <p className="gp-stat-card__value">
                {requests.filter((r) => r.status === 'pending').length}
              </p>
            </div>
          </article>

          <article className="gp-stat-card" data-reveal-item data-hover="lift">
            <span className="gp-icon-mark gp-icon-mark--stat gp-icon-mark--green" aria-hidden="true">
              <Icon name="wallet" size={19} />
            </span>
            <div className="gp-stat-card__body">
              <p className="gp-stat-card__label">Pending amount</p>
              <p className="gp-stat-card__value">{money(pendingTotal)}</p>
            </div>
          </article>

          <article className="gp-stat-card" data-reveal-item data-hover="lift">
            <span className="gp-icon-mark gp-icon-mark--stat gp-icon-mark--blue" aria-hidden="true">
              <Icon name="grid" size={19} />
            </span>
            <div className="gp-stat-card__body">
              <p className="gp-stat-card__label">Shown</p>
              <p className="gp-stat-card__value">{requests.length}</p>
            </div>
          </article>
        </div>

        <section className="gp-card">
          <header className="gp-card-head">
            <div>
              <p className="gp-card-head__eyebrow">Queue</p>
              <h3 className="gp-card-head__title">
                {filter === 'pending' ? 'Pending requests' : 'All requests'}
              </h3>
              <p className="gp-card-head__desc">
                Crediting is idempotent: a request can only be settled once.
              </p>
            </div>
          </header>

          <AdminTopUpsTable requests={requests} />
        </section>
      </div>
    </div>
  );
}
