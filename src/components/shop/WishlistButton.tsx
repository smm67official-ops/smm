'use client';

import { useBasket } from '@/components/providers/BasketProvider';
import type { Dictionary } from '@/i18n';

/** Cœur plein / vide, persistant en base pour un utilisateur connecté. */
export default function WishlistButton({
  service,
  t,
  variant = 'button',
}: {
  service: { id: string; name: string; rate: number; platform: string | null };
  t: Dictionary;
  variant?: 'button' | 'icon';
}) {
  const { toggleFavorite, isFavorite, ready } = useBasket();
  const active = ready && isFavorite(service.id);

  const onClick = () =>
    toggleFavorite({
      serviceId: service.id,
      name: service.name,
      rate: service.rate,
      platform: service.platform,
    });

  if (variant === 'icon') {
    return (
      <button
        type="button"
        className="tm-favorite-toggle"
        aria-pressed={active}
        aria-label={t.nav.favorites}
        title={t.nav.favorites}
        onClick={onClick}
      >
        <i
          className={active ? 'ion-heart' : 'ion-ios-heart-outline'}
          style={active ? { color: '#f2ba59' } : undefined}
        />
      </button>
    );
  }

  return (
    <button
      type="button"
      className="tm-button tm-button-small"
      aria-pressed={active}
      onClick={onClick}
      style={active ? { background: '#f2ba59', borderColor: '#f2ba59' } : undefined}
    >
      <i className={active ? 'ion-heart' : 'ion-ios-heart-outline'} style={{ marginInlineEnd: 6 }} />
      {t.nav.favorites}
    </button>
  );
}
