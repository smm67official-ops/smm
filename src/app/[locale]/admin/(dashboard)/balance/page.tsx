import { redirect } from 'next/navigation';
import { Icon } from '@/design-system';
import BalanceVerification from '@/components/admin/BalanceVerification';
import { requireAdmin } from '@/lib/auth';
import { verifyBalances } from '@/lib/balance';
import { listAuditLogs } from '@/lib/audit';

/**
 * Rapprochement fournisseur / plateforme.
 *  
 * `force-dynamic` : un rapport de cohérence mis en cache dirait
 * « cohérent » longtemps après que ce ne soit plus vrai.
 */
export const dynamic = 'force-dynamic';

type Params = Promise<{ locale: string }>;

const money = (value: number | null | undefined) =>
  value === null || value === undefined ? '—' : `$${Number(value).toFixed(2)}`;

export default async function AdminBalancePage({ params }: { params: Params }) {
  const auth = await requireAdmin();
  const { locale } = await params;
  if (!auth.ok) redirect(`/${locale}/admin/login`);

  const [report, logs] = await Promise.all([
    verifyBalances(auth.user.id),
    listAuditLogs(25),
  ]);

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
              <p className="gp-hero__eyebrow">Finance</p>
              <h2 className="gp-hero__title">Balance control</h2>
              <p className="gp-hero__desc">
                What SMMGen holds, what the platform has committed to clients, and whether the two
                still agree. Nothing here is corrected automatically.
              </p>
            </div>
          </div>
        </div>
      </header>

      <div className="gp-stage">
        <BalanceVerification initial={report} />

        <section className="gp-card">
          <header className="gp-card-head">
            <div>
              <p className="gp-card-head__eyebrow">Audit</p>
              <h3 className="gp-card-head__title">Recent sensitive actions</h3>
              <p className="gp-card-head__desc">
                Allocations, blocks and synchronisations. Never contains secrets or tokens.
              </p>
            </div>
          </header>

          {logs.length === 0 ? (
            <div className="gp-empty">
              <span className="gp-empty__icon">
                <Icon name="info" size={22} />
              </span>
              <p style={{ margin: 0 }}>No action recorded yet.</p>
            </div>
          ) : (
            <div className="gp-table-wrap">
              <table className="gp-table rs-table">
                <thead>
                  <tr>
                    <th>When</th>
                    <th>Action</th>
                    <th className="gp-table__num">Amount</th>
                    <th className="rs-col-optional">Target</th>
                  </tr>
                </thead>
                <tbody>
                  {logs.map((log) => (
                    <tr key={log.id}>
                      <td className="gp-table__muted" data-label="When">
                        {new Date(log.created_at).toLocaleString('en-GB', {
                          dateStyle: 'medium',
                          timeStyle: 'short',
                        })}
                      </td>
                      <td data-label="Action" className="gp-table__strong rs-cell--head">
                        {log.action}
                      </td>
                      <td className="gp-table__num" data-label="Amount">
                        {log.amount === null ? '—' : money(Number(log.amount))}
                      </td>
                      <td className="gp-table__muted rs-col-optional" data-label="Target">
                        {log.target_id ? log.target_id.slice(0, 8) : '—'}
                      </td>
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
