'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useBasket } from '@/components/providers/BasketProvider';
import type { Locale } from '@/i18n/config';
import type { Dictionary } from '@/i18n';

/**
 * Navigation basse, mobile uniquement.
 * Quatre destinations maximum : au-delà, les cibles deviennent trop
 * petites et le choix trop coûteux.
 */
export default function BottomNav({
  locale,
  t,
  signedIn,
}: {
  locale: Locale;
  t: Dictionary;
  signedIn: boolean;
}) {
  const pathname = usePathname();
  const { count } = useBasket();

  const href = (path: string) => `/${locale}${path}`;

  // Libellés courts : au-delà d'un mot, le texte passe à la ligne et
  // déborde de la barre de 64px.
  const items = [
    { href: href('/services'), icon: 'ion-ios-home', label: t.dashboard.navShop, match: /\/services/ },
    { href: href('/cart'), icon: 'ion-bag', label: t.dashboard.navCart, match: /\/(cart|checkout)/, badge: count },
    { href: href('/account/orders'), icon: 'ion-cube', label: t.dashboard.navOrders, match: /\/account\/orders/ },
    {
      href: href(signedIn ? '/account' : '/login'),
      icon: 'ion-person',
      label: signedIn ? t.dashboard.navAccount : t.nav.login,
      match: /\/(account|login)$/,
    },
  ];

  // Masquée dans l'espace d'administration.
  if (/\/admin(\/|$)/.test(pathname)) return null;

  return (
    <nav className="cx-bottomnav" aria-label="Main">
      {items.map((item) => {
        const active = item.match.test(pathname);
        return (
          <Link
            key={item.href + item.label}
            href={item.href}
            className={`cx-bottomnav__item${active ? ' is-active' : ''}`}
            aria-current={active ? 'page' : undefined}
          >
            <i className={item.icon} />
            {item.badge ? <span className="cx-bottomnav__badge">{item.badge}</span> : null}
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
