'use client';

import Link from 'next/link';
import { useBasket } from '@/components/providers/BasketProvider';
import { platformOf } from '@/lib/platforms';
import { rate as fmtRate } from '@/lib/format';
import type { Locale } from '@/i18n/config';
import type { Dictionary } from '@/i18n';
import type { Service } from '@/lib/supabase/types';

export default function ServiceTable({
  locale,
  t,
  services,
}: {
  locale: Locale;
  t: Dictionary;
  services: Service[];
}) {
  const { toggleFavorite, isFavorite } = useBasket();

  return (
    <div className="tm-cart-table tm-servicetable table-responsive">
      <table className="table table-bordered mb-0 rs-table">
        <thead>
          <tr>
            <th scope="col">{t.services.colId}</th>
            <th scope="col">{t.services.colService}</th>
            <th scope="col">{t.services.colRate}</th>
            <th scope="col">{t.services.colMin}</th>
            <th scope="col">{t.services.colMax}</th>
            <th scope="col">{t.services.colAction}</th>
          </tr>
        </thead>
        <tbody>
          {services.map((service) => {
            const platform = platformOf(service.platform);
            const favorite = isFavorite(service.id);

            return (
              <tr key={service.id}>
                <td data-label={t.services.colId}>{service.provider_service_id}</td>
                <td data-label="" className="rs-cell--head">
                  <Link href={`/${locale}/services/${service.id}`} className="tm-servicetable-name">
                    {platform && (
                      <i className={platform.icon} style={{ color: platform.color }} />
                    )}
                    {service.name}
                  </Link>
                  {service.category_name && (
                    <span className="tm-servicetable-category">{service.category_name}</span>
                  )}
                </td>
                <td className="tm-cart-price" data-label={t.services.colRate}>{fmtRate(service.rate)}</td>
                <td data-label={t.services.colMin}>{service.min.toLocaleString()}</td>
                <td data-label={t.services.colMax}>{service.max.toLocaleString()}</td>
                <td className="tm-servicetable-actions" data-label="">
                  <Link href={`/${locale}/services/${service.id}`} className="tm-button tm-button-small">
                    {t.services.order}
                  </Link>
                  <button
                    type="button"
                    className="tm-favorite-toggle"
                    aria-pressed={favorite}
                    aria-label={t.nav.favorites}
                    title={t.nav.favorites}
                    onClick={() =>
                      toggleFavorite({
                        serviceId: service.id,
                        name: service.name,
                        rate: service.rate,
                        platform: service.platform,
                      })
                    }
                  >
                    <i
                      className={favorite ? 'ion-heart' : 'ion-ios-heart-outline'}
                      style={favorite ? { color: '#f2ba59' } : undefined}
                    />
                  </button>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
