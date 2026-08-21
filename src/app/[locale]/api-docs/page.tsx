import { notFound } from 'next/navigation';
import Breadcrumb from '@/components/ui/Breadcrumb';
import { API_DOCS_ENABLED } from '@/lib/brand';
import { getDictionary } from '@/i18n';
import type { Locale } from '@/i18n/config';

type Params = Promise<{ locale: string }>;

const ACTIONS = [
  { action: 'services', params: 'key, action', purpose: 'List all services (id, name, category, rate, min, max, refill, cancel)' },
  { action: 'add', params: 'key, action, service, link, quantity [, runs, interval]', purpose: 'Create an order' },
  { action: 'status', params: 'key, action, order', purpose: 'Order status' },
  { action: 'status (bulk)', params: 'key, action, orders (≤ 100 ids)', purpose: 'Status of up to 100 orders' },
  { action: 'refill', params: 'key, action, order', purpose: 'Create a refill' },
  { action: 'refill_status', params: 'key, action, refill', purpose: 'Refill status' },
  { action: 'cancel', params: 'key, action, orders (≤ 100 ids)', purpose: 'Cancel orders (bulk only)' },
  { action: 'balance', params: 'key, action', purpose: 'Account balance' },
];

export default async function ApiDocsPage({ params }: { params: Params }) {
  // Masquée : la page ne doit pas être atteignable par son URL non plus.
  if (!API_DOCS_ENABLED) notFound();

  const { locale } = await params;
  const t = getDictionary(locale);

  return (
    <>
      <Breadcrumb locale={locale as Locale} title={t.api.title} crumbs={[{ label: t.api.title }]} />

      <main className="page-content">
        <div className="tm-section bg-white tm-padding-section">
          <div className="container">
            <div className="row justify-content-center">
              <div className="col-lg-8 col-12">
                <div className="tm-sectiontitle text-center">
                  <h3>{t.api.title}</h3>
                  <p>{t.api.subtitle}</p>
                </div>
              </div>
            </div>

            <p>{t.api.intro}</p>

            <div className="table-responsive tm-cart-table">
              <table className="table table-bordered mb-0">
                <tbody>
                  <tr>
                    <td><b>{t.api.endpoint}</b></td>
                    <td><code>https://your-domain.com/api/v2</code></td>
                  </tr>
                  <tr>
                    <td><b>{t.api.method}</b></td>
                    <td><code>POST</code> — <code>application/x-www-form-urlencoded</code></td>
                  </tr>
                  <tr>
                    <td><b>{t.api.format}</b></td>
                    <td><code>JSON</code></td>
                  </tr>
                  <tr>
                    <td><b>{t.api.key}</b></td>
                    <td>{t.api.keyHelp}</td>
                  </tr>
                </tbody>
              </table>
            </div>

            <h4 style={{ marginTop: 40 }}>{t.api.actions}</h4>
            <div className="table-responsive tm-cart-table">
              <table className="table table-bordered mb-0">
                <thead>
                  <tr>
                    <th>Action</th>
                    <th>Parameters</th>
                    <th>Purpose</th>
                  </tr>
                </thead>
                <tbody>
                  {ACTIONS.map((row) => (
                    <tr key={row.action}>
                      <td><code>{row.action}</code></td>
                      <td><code>{row.params}</code></td>
                      <td>{row.purpose}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <h4 style={{ marginTop: 40 }}>Example</h4>
            <pre className="tm-codeblock">
{`curl -X POST https://your-domain.com/api/v2 \\
  -d "key=YOUR_API_KEY" \\
  -d "action=add" \\
  -d "service=1" \\
  -d "link=https://instagram.com/your-account" \\
  -d "quantity=1000"

# → {"order": 23501}`}
            </pre>

            <p className="tm-alert">
              Note: the reseller endpoint <code>/api/v2</code> is specified but not implemented yet —
              only the internal route <code>/api/smm/order</code> is live. See the README.
            </p>
          </div>
        </div>
      </main>
    </>
  );
}
