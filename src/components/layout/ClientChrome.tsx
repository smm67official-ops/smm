'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { useBasket } from '@/components/providers/BasketProvider';
import { createClient } from '@/lib/supabase/client';
import { BRAND } from '@/lib/brand';
import type { Locale } from '@/i18n/config';
import type { Dictionary } from '@/i18n';

/**
 * Routes servies par l'habillage « application client » (cx).
 * Sur ces routes l'en-tête marketing du thème est masqué : deux barres
 * superposées volaient un tiers de l'écran sur mobile.
 */
export const CX_ROUTE = /\/(account|cart|checkout|wishlist)(\/|$)/;

/**
 * Habillage de l'espace client.
 * - mobile / tablette : barre d'application collante + navigation basse
 * - desktop (>= 1024px) : rail latéral permanent, la barre reste pour le
 *   panier et le menu de compte
 */
export default function ClientChrome({
  locale,
  t,
  email,
  name,
}: {
  locale: Locale;
  t: Dictionary;
  email: string | null;
  name: string | null;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const { count } = useBasket();
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  const active = CX_ROUTE.test(pathname);

  // Marque le document : la mise en page décale son contenu pour le rail.
  useEffect(() => {
    document.body.classList.toggle('cx-app', active);
    return () => document.body.classList.remove('cx-app');
  }, [active]);

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('click', onClick);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('click', onClick);
      document.removeEventListener('keydown', onKey);
    };
  }, []);

  if (!active) return null;

  const signedIn = Boolean(email);
  const display = name || email?.split('@')[0] || '';
  const initials = (display || '?').slice(0, 2).toUpperCase();

  const signOut = async () => {
    await createClient().auth.signOut();
    router.push(`/${locale}`);
    router.refresh();
  };

  const rail = [
    { href: `/${locale}/account`, icon: 'ion-speedometer', label: t.dashboard.title, exact: true },
    { href: `/${locale}/account/orders`, icon: 'ion-cube', label: t.orderHistory.title },
    { href: `/${locale}/account/wallet`, icon: 'ion-card', label: t.wallet.title },
    { href: `/${locale}/wishlist`, icon: 'ion-heart', label: t.nav.favorites },
    { href: `/${locale}/cart`, icon: 'ion-bag', label: t.nav.cart },
    { href: `/${locale}/account/profile`, icon: 'ion-person', label: t.dashboard.profile },
  ];

  return (
    <>
      <header className="cx-appbar">
        <Link href={`/${locale}`} className="cx-appbar__logo" aria-label={BRAND.name}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={BRAND.logo} alt={BRAND.name} />
        </Link>

        <span className="cx-appbar__spacer" />

        <Link href={`/${locale}/services`} className="cx-iconbtn" aria-label={t.nav.services}>
          <i className="ion-ios-search" />
        </Link>

        <Link href={`/${locale}/cart`} className="cx-iconbtn" aria-label={t.nav.cart}>
          <i className="ion-bag" />
          {count > 0 && <span className="cx-iconbtn__dot">{count}</span>}
        </Link>

        {signedIn ? (
          <div className="cx-appbar__menu" ref={menuRef}>
            <button
              type="button"
              className="cx-avatar"
              aria-label={t.nav.account}
              aria-expanded={open}
              aria-haspopup="menu"
              onClick={() => setOpen((v) => !v)}
            >
              {initials}
            </button>

            {open && (
              <ul className="cx-menu" role="menu">
                <li className="cx-menu__head">
                  <strong>{display}</strong>
                  <span>{email}</span>
                </li>
                <li role="none">
                  <Link role="menuitem" href={`/${locale}/account`}>
                    <i className="ion-speedometer" />
                    {t.dashboard.title}
                  </Link>
                </li>
                <li role="none">
                  <Link role="menuitem" href={`/${locale}/account/orders`}>
                    <i className="ion-cube" />
                    {t.orderHistory.title}
                  </Link>
                </li>
                <li role="none">
                  <Link role="menuitem" href={`/${locale}/account/wallet`}>
                    <i className="ion-card" />
                    {t.wallet.title}
                  </Link>
                </li>
                <li role="none">
                  <Link role="menuitem" href={`/${locale}/account/profile`}>
                    <i className="ion-person" />
                    {t.dashboard.profile}
                  </Link>
                </li>
                <li role="none">
                  <button role="menuitem" type="button" onClick={() => void signOut()}>
                    <i className="ion-log-out" />
                    {t.nav.logout}
                  </button>
                </li>
              </ul>
            )}
          </div>
        ) : (
          <Link href={`/${locale}/login`} className="cx-btn cx-btn--sm cx-btn--primary">
            {t.nav.login}
          </Link>
        )}
      </header>

      {/* Rail latéral — desktop uniquement */}
      <aside className="cx-rail" aria-label={t.dashboard.title}>
        <nav className="cx-rail__nav">
          {rail.map((item) => {
            const isActive = item.exact ? pathname === item.href : pathname.startsWith(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`cx-rail__link${isActive ? ' is-active' : ''}`}
                aria-current={isActive ? 'page' : undefined}
              >
                <i className={item.icon} />
                <span>{item.label}</span>
              </Link>
            );
          })}
        </nav>

        <div className="cx-rail__foot">
          <Link href={`/${locale}/services`} className="cx-btn cx-btn--sm cx-btn--primary">
            <i className="ion-plus" />
            {t.dashboard.orderNow}
          </Link>
        </div>
      </aside>
    </>
  );
}
