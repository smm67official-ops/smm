import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import Breadcrumb from '@/components/ui/Breadcrumb';
import OrderForm from '@/components/shop/OrderForm';
import ServiceTable from '@/components/shop/ServiceTable';
import WishlistButton from '@/components/shop/WishlistButton';
import { getRelatedServices, getServiceById } from '@/lib/queries';
import { getDictionary } from '@/i18n';
import { platformOf } from '@/lib/platforms';
import { rate as fmtRate } from '@/lib/format';
import type { Locale } from '@/i18n/config';

type Params = Promise<{ locale: string; id: string }>;

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { id } = await params;
  const service = await getServiceById(id);
  return { title: service?.name ?? 'Service' };
}

export default async function ServiceDetailsPage({ params }: { params: Params }) {
  const { locale, id } = await params;
  const t = getDictionary(locale);
  const l = locale as Locale;

  const service = await getServiceById(id);
  if (!service) notFound();

  const related = await getRelatedServices(service.category_id, service.id, 8);
  const platform = platformOf(service.platform);

  return (
    <>
      <Breadcrumb
        locale={l}
        title={service.name}
        crumbs={[
          { label: t.services.title, href: `/${l}/services` },
          { label: service.category_name ?? service.name },
        ]}
      />

      <main className="page-content">
        <div className="tm-section tm-prodetails-area bg-white tm-padding-section">
          <div className="container">
            <div className="row">
              <div className="col-lg-5 col-12">
                <div className="tm-servicecard">
                  {platform && (
                    <span className="tm-platform-icon tm-platform-icon-lg" style={{ backgroundColor: platform.color }}>
                      <i className={platform.icon} />
                    </span>
                  )}
                  <h4>{service.name}</h4>
                  {service.category_name && (
                    <p className="tm-servicecard-category">{service.category_name}</p>
                  )}

                  <ul className="tm-servicecard-specs">
                    <li>
                      <b>{t.service.rate}</b>
                      <span>{fmtRate(service.rate)}</span>
                    </li>
                    <li>
                      <b>{t.service.min}</b>
                      <span>{service.min.toLocaleString()}</span>
                    </li>
                    <li>
                      <b>{t.service.max}</b>
                      <span>{service.max.toLocaleString()}</span>
                    </li>
                    <li>
                      <b>{t.service.refill}</b>
                      <span className={service.refill ? 'color-theme' : undefined}>
                        {service.refill ? t.service.available : t.service.notAvailable}
                      </span>
                    </li>
                    <li>
                      <b>{t.service.cancel}</b>
                      <span className={service.cancel ? 'color-theme' : undefined}>
                        {service.cancel ? t.service.available : t.service.notAvailable}
                      </span>
                    </li>
                    <li>
                      <b>ID</b>
                      <span>{service.provider_service_id}</span>
                    </li>
                  </ul>

                  <div style={{ marginTop: 20 }}>
                    <WishlistButton
                      t={t}
                      service={{
                        id: service.id,
                        name: service.name,
                        rate: service.rate,
                        platform: service.platform,
                      }}
                    />
                  </div>

                  {service.description && (
                    <div className="tm-servicecard-description">
                      <h6>{t.service.description}</h6>
                      <p>{service.description}</p>
                    </div>
                  )}
                </div>
              </div>

              <div className="col-lg-7 col-12">
                <OrderForm locale={l} t={t} service={service} />
              </div>
            </div>
          </div>
        </div>

        {related.length > 0 && (
          <div className="tm-section bg-grey tm-padding-section">
            <div className="container">
              <div className="row justify-content-center">
                <div className="col-lg-8 col-12">
                  <div className="tm-sectiontitle text-center">
                    <h3>{t.service.relatedTitle}</h3>
                  </div>
                </div>
              </div>
              <ServiceTable locale={l} t={t} services={related} />
              <div className="text-center" style={{ marginTop: 30 }}>
                <Link href={`/${l}/services`} className="tm-button">
                  {t.services.title}
                </Link>
              </div>
            </div>
          </div>
        )}
      </main>
    </>
  );
}
