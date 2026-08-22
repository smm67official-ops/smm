'use client';

import { useRef } from 'react';
import { useBasket } from '@/components/providers/BasketProvider';
import { useCxToast } from '@/components/motion/ToastProvider';
import { favoriteToggle } from '@/lib/motion/presets';
import type { Dictionary } from '@/i18n';

/**
 * Cœur plein / vide, persistant en base pour un utilisateur connecté.
 *
 * La bascule est optimiste : l'icône change tout de suite, puis
 * `toggleFavorite` confirme ou rétablit. Un échec d'écriture n'est plus
 * silencieux — il revient à l'état précédent et le dit.
 */
export default function WishlistButton({
  service,
  t,
  variant = 'button',
}: {
  service: { id: string; name: string; rate: number; platform: string | null };
  t: Dictionary;
  variant?: 'button' | 'icon';
}) {
  const { toggleFavorite, isFavorite, ready, pendingFavorites } = useBasket();
  const { toast } = useCxToast();
  const iconRef = useRef<HTMLElement>(null);

  const active = ready && isFavorite(service.id);
  const busy = pendingFavorites.includes(service.id);

  const onClick = async () => {
    if (busy) return; // évite la double écriture sur double clic

    // L'animation suit l'état visé, pas l'état courant.
    favoriteToggle(iconRef.current, !active);

    const result = await toggleFavorite({
      serviceId: service.id,
      name: service.name,
      rate: service.rate,
      platform: service.platform,
    });

    if (!result.ok) {
      toast({ tone: 'error', title: t.favorites.error });
      return;
    }

    toast({
      tone: 'success',
      title: result.favorited ? t.favorites.added : t.favorites.removed,
      description: result.favorited ? service.name : undefined,
      duration: 2600,
    });
  };

  const icon = (
    <i
      ref={iconRef}
      className={active ? 'ion-heart' : 'ion-ios-heart-outline'}
      style={{
        display: 'inline-block',
        color: active ? '#f2ba59' : undefined,
        marginInlineEnd: variant === 'button' ? 6 : undefined,
      }}
    />
  );

  if (variant === 'icon') {
    return (
      <button
        type="button"
        className="tm-favorite-toggle"
        aria-pressed={active}
        aria-busy={busy}
        aria-label={t.nav.favorites}
        title={t.nav.favorites}
        disabled={busy}
        onClick={() => void onClick()}
      >
        {icon}
      </button>
    );
  }

  return (
    <button
      type="button"
      className="tm-button tm-button-small"
      aria-pressed={active}
      aria-busy={busy}
      disabled={busy}
      onClick={() => void onClick()}
      style={active ? { background: '#f2ba59', borderColor: '#f2ba59' } : undefined}
    >
      {icon}
      {t.nav.favorites}
    </button>
  );
}
