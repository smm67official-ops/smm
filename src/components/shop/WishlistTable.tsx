'use client';

import Link from 'next/link';
import { useBasket } from '@/components/providers/BasketProvider';
import { useCxToast } from '@/components/motion/ToastProvider';
import { rate as fmtRate } from '@/lib/format';
import { platformOf } from '@/lib/platforms';
import type { Locale } from '@/i18n/config';
import type { Dictionary } from '@/i18n';

export default function WishlistTable({ locale, t }: { locale: Locale; t: Dictionary }) {
  const { favorites, ready, syncing, isAuthenticated, removeFavorite, pendingFavorites } =
    useBasket();
  const { toast } = useCxToast();

  /**
   * Retrait d'un favori.
   * L'écriture peut échouer (session expirée, réseau) : le fournisseur
   * rétablit alors la ligne, et il faut le dire plutôt que de laisser
   * l'élément réapparaître sans explication.
   */
  const onRemove = async (serviceId: string, name: string) => {
    const result = await removeFavorite(serviceId);
    toast(
      result.ok
        ? { tone: 'success', title: t.favorites.removed, description: name, duration: 2600 }
        : { tone: 'error', title: t.favorites.error }
    );
  };

  if (!ready || syncing) return <p>{t.common.loading}</p>;

  return (
    <>
      {/* Sans compte, la liste ne survit pas à un changement d'appareil. */}
      {!isAuthenticated && (
        <p className="tm-alert">
          {t.auth.noAccount}{' '}
          <Link href={`/${locale}/login?redirect=/${locale}/wishlist`}>{t.auth.login}</Link>
        </p>
      )}

      {favorites.length === 0 ? (
        <div className="tm-empty">
          <i className="ion-heart" />
          <p>{t.favorites.empty}</p>
          <Link href={`/${locale}/services`} className="tm-button">
            {t.cart.browse}
          </Link>
        </div>
      ) : (
        <div className="tm-wishlist-table table-responsive">
          <table className="table table-bordered mb-0 rs-table">
            <thead>
              <tr>
                <th scope="col">{t.favorites.colService}</th>
                <th scope="col">{t.favorites.colRate}</th>
                <th scope="col">{t.favorites.colAdd}</th>
                <th scope="col">{t.favorites.colRemove}</th>
              </tr>
            </thead>
            <tbody>
              {favorites.map((line) => {
                const platform = platformOf(line.platform);
                return (
                  <tr key={line.serviceId}>
                    <td data-label="" className="rs-cell--head">
                      <Link
                        href={`/${locale}/services/${line.serviceId}`}
                        className="tm-wishlist-productname"
                      >
                        {platform && <i className={platform.icon} style={{ color: platform.color }} />}
                        {line.name}
                      </Link>
                    </td>
                    <td className="tm-wishlist-price" data-label={t.favorites.colRate}>{fmtRate(line.rate)}</td>
                    <td data-label="">
                      {/* Le lien et la quantité sont obligatoires : on passe par la fiche service. */}
                      <Link
                        href={`/${locale}/services/${line.serviceId}`}
                        className="tm-button tm-button-small"
                      >
                        {t.services.order}
                      </Link>
                      <span className="tm-wishlist-hint">{t.favorites.addToBasketHint}</span>
                    </td>
                    <td data-label="">
                      <button
                        type="button"
                        className="tm-wishlist-removeproduct"
                        aria-label={t.favorites.colRemove}
                        aria-busy={pendingFavorites.includes(line.serviceId)}
                        disabled={pendingFavorites.includes(line.serviceId)}
                        onClick={() => void onRemove(line.serviceId, line.name)}
                      >
                        <i className="ion-close" />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
