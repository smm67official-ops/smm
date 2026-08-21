import Link from 'next/link';
import Breadcrumb from '@/components/ui/Breadcrumb';
import ServiceFilters from '@/components/shop/ServiceFilters';
import ServiceTable from '@/components/shop/ServiceTable';
import { getServiceCategories, getServices, hasSupabaseEnv } from '@/lib/queries';
import { getDictionary } from '@/i18n';
import type { Locale } from '@/i18n/config';

type Params = Promise<{ locale: string }>;
type SearchParams = Promise<Record<string, string | string[] | undefined>>;

const PER_PAGE = 25;
const first = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

export default async function ServicesPage({
  params,
  searchParams,
}: {
  params: Params;
  searchParams: SearchParams;
}) {
  const { locale } = await params;
  const sp = await searchParams;
  const t = getDictionary(locale);
  const l = locale as Locale;

  const page = Math.max(1, Number(first(sp.page) ?? 1) || 1);
  const platform = first(sp.platform);
  const category = first(sp.category);

  const [{ services, total }, categories] = await Promise.all([
    getServices({
      q: first(sp.q) || undefined,
      platform: platform || undefined,
      category: category || undefined,
      sort: (first(sp.sort) as 'default' | 'price-asc' | 'price-desc') || 'default',
      page,
      perPage: PER_PAGE,
    }),
    getServiceCategories(platform || undefined),
  ]);

  const pages = Math.max(1, Math.ceil(total / PER_PAGE));
  const from = total === 0 ? 0 : (page - 1) * PER_PAGE + 1;
  const to = Math.min(page * PER_PAGE, total);

  const pageHref = (n: number) => {
    const query = new URLSearchParams();
    Object.entries(sp).forEach(([k, v]) => {
      const value = first(v);
      if (value && k !== 'page') query.set(k, value);
    });
    if (n > 1) query.set('page', String(n));
    const qs = query.toString();
    return qs ? `/${l}/services?${qs}` : `/${l}/services`;
  };

  return (
    <>
      <Breadcrumb locale={l} title={t.services.title} crumbs={[{ label: t.services.title }]} />

      <main className="page-content">
        <div className="tm-section tm-shop-area bg-white tm-padding-section">
          <div className="container">
            <div className="row justify-content-center">
              <div className="col-lg-8 col-12" data-motion="head">
                <div className="tm-sectiontitle text-center">
                  <h3>{t.services.title}</h3>
                  <p>{t.services.subtitle}</p>
                </div>
              </div>
            </div>

            <div data-motion="body">
              <ServiceFilters locale={l} t={t} categories={categories} />
            </div>

            {services.length === 0 ? (
              <div className="tm-empty">
                <i className="ion-search" />
                <p>{hasSupabaseEnv() && total === 0 ? t.services.notSynced : t.services.empty}</p>
                <Link href={`/${l}/services`} className="tm-button">
                  {t.services.reset}
                </Link>
              </div>
            ) : (
              <>
                <p className="tm-shop-countview">
                  {t.services.showing} {from}–{to} {t.services.of} {total}
                </p>

                <ServiceTable locale={l} t={t} services={services} />

                {pages > 1 && (
                  <div className="tm-pagination mt-50">
                    <ul>
                      {page > 1 && (
                        <li>
                          <Link href={pageHref(page - 1)} aria-label="Previous page">
                            <i className="ion-chevron-left" />
                          </Link>
                        </li>
                      )}
                      {Array.from({ length: Math.min(pages, 8) }, (_, i) => {
                        // Fenêtre glissante autour de la page courante.
                        const start = Math.max(1, Math.min(page - 3, pages - 7));
                        return start + i;
                      })
                        .filter((n) => n >= 1 && n <= pages)
                        .map((n) => (
                          <li key={n} className={n === page ? 'is-active' : undefined}>
                            <Link href={pageHref(n)}>{n}</Link>
                          </li>
                        ))}
                      {page < pages && (
                        <li>
                          <Link href={pageHref(page + 1)} aria-label="Next page">
                            <i className="ion-chevron-right" />
                          </Link>
                        </li>
                      )}
                    </ul>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </main>
    </>
  );
}
