'use client';

import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { useBasket } from '@/components/providers/BasketProvider';
import { createClient } from '@/lib/supabase/client';
import { LOCALES, LOCALE_META, type Locale } from '@/i18n/config';
import { API_DOCS_ENABLED, BRAND } from '@/lib/brand';
import type { Dictionary } from '@/i18n';

export default function Header({
  locale,
  t,
  userEmail,
  userRole,
}: {
  locale: Locale;
  t: Dictionary;
  userEmail: string | null;
  userRole?: string | null;
}) {
  const { count, favorites } = useBasket();
  const router = useRouter();
  const pathname = usePathname();

  const [langOpen, setLangOpen] = useState(false);
  const [accountOpen, setAccountOpen] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [sticky, setSticky] = useState(false);
  const [term, setTerm] = useState('');
  const actionsRef = useRef<HTMLDivElement>(null);

  const href = (path: string) => `/${locale}${path}`;
  const isStaff = userRole === 'admin' || userRole === 'support';

  const NAV = [
    { label: t.nav.home, href: href('/') },
    { label: t.nav.services, href: href('/services') },
    ...(API_DOCS_ENABLED ? [{ label: t.nav.api, href: href('/api-docs') }] : []),
    { label: t.nav.cart, href: href('/cart') },
    { label: t.nav.contact, href: href('/contact') },
  ];

  useEffect(() => {
    const onScroll = () => setSticky(window.scrollY > 400);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (actionsRef.current && !actionsRef.current.contains(e.target as Node)) {
        setLangOpen(false);
        setAccountOpen(false);
      }
    };
    document.addEventListener('click', onClick);
    return () => document.removeEventListener('click', onClick);
  }, []);

  useEffect(() => {
    setMobileOpen(false);
    setLangOpen(false);
    setAccountOpen(false);
  }, [pathname]);

  const onSearch = (e: React.FormEvent) => {
    e.preventDefault();
    const q = term.trim();
    router.push(q ? `${href('/services')}?q=${encodeURIComponent(q)}` : href('/services'));
  };

  const switchLocale = (next: Locale) => {
    // Le cookie mémorise le choix pour les prochaines visites (voir middleware).
    document.cookie = `NEXT_LOCALE=${next}; path=/; max-age=${60 * 60 * 24 * 365}`;
    const rest = pathname.replace(/^\/[^/]+/, '');
    router.push(`/${next}${rest}`);
    router.refresh();
  };

  const signOut = async () => {
    await createClient().auth.signOut();
    router.push(href('/'));
    router.refresh();
  };

  return (
    <div className={`tm-header tm-header-sticky${sticky ? ' is-sticky' : ''}`}>
      {/* Header Middle Area — logo, recherche, actions */}
      <div className="tm-header-middlearea bg-white">
        <div className="container">
          <div className="row align-items-center">
            <div className="col-lg-3 col-6 order-1">
              <Link href={href('/')} className="tm-header-logo">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={BRAND.logo} alt={`${BRAND.name} — ${BRAND.tagline}`} />
              </Link>
            </div>

            <div className="col-lg-4 col-12 order-3 order-lg-2">
              <form className="tm-header-search" onSubmit={onSearch}>
                <input
                  type="text"
                  placeholder={t.header.searchPlaceholder}
                  value={term}
                  onChange={(e) => setTerm(e.target.value)}
                  aria-label={t.header.searchPlaceholder}
                />
                <button type="submit" aria-label={t.header.searchPlaceholder}>
                  <i className="ion-android-search" />
                </button>
              </form>
            </div>

            <div className="col-lg-5 col-6 order-2 order-lg-3">
              <div className="tm-navactions" ref={actionsRef}>
                {/* Sélecteur de langue */}
                <div className="tm-navactions-lang">
                  <button
                    type="button"
                    className="tm-navlang-toggle"
                    aria-expanded={langOpen}
                    aria-label="Language"
                    onClick={() => {
                      setLangOpen((v) => !v);
                      setAccountOpen(false);
                    }}
                  >
                    <i className="ion-earth" />
                    <span>{LOCALE_META[locale].label}</span>
                    <i className="ion-chevron-down" />
                  </button>
                  {langOpen && (
                    <ul className="tm-navdropdown">
                      {LOCALES.map((l) => (
                        <li key={l}>
                          <a
                            href={`/${l}`}
                            className={l === locale ? 'is-active' : undefined}
                            onClick={(e) => {
                              e.preventDefault();
                              switchLocale(l);
                            }}
                          >
                            {LOCALE_META[l].label}
                          </a>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>

                {/* Wishlist et panier */}
                <ul className="tm-header-icons">
                  <li>
                    <Link href={href('/wishlist')} aria-label={t.nav.favorites}>
                      <i className="ion-android-favorite-outline" />
                      <span>{favorites.length}</span>
                    </Link>
                  </li>
                  <li>
                    <Link href={href('/cart')} aria-label={t.nav.cart}>
                      <i className="ion-bag" />
                      <span>{count}</span>
                    </Link>
                  </li>
                </ul>

                {/* Raccourci visible en permanence pour l'équipe */}
                {isStaff && (
                  <Link href={href('/admin')} className="tm-navbtn tm-navbtn-admin" title="Admin panel">
                    <i className="ion-speedometer" />
                    <span>Admin</span>
                  </Link>
                )}

                {/* Connexion / inscription ou compte */}
                {userEmail ? (
                  <div className="tm-navactions-account">
                    <button
                      type="button"
                      className="tm-navbtn tm-navbtn-ghost"
                      aria-expanded={accountOpen}
                      onClick={() => {
                        setAccountOpen((v) => !v);
                        setLangOpen(false);
                      }}
                    >
                      <i className="ion-android-person" />
                      <span>{t.nav.account}</span>
                    </button>
                    {accountOpen && (
                      <ul className="tm-navdropdown tm-navdropdown-end">
                        {isStaff && (
                          <li>
                            <Link href={href('/admin')} className="tm-navdropdown-admin">
                              <i className="ion-speedometer" /> Admin panel
                            </Link>
                          </li>
                        )}
                        <li><Link href={href('/account')}>{t.account.dashboard}</Link></li>
                        <li><Link href={href('/account/orders')}>{t.orderHistory.title}</Link></li>
                        <li><Link href={href('/account/wallet')}>{t.wallet.title}</Link></li>
                        <li><Link href={href('/wishlist')}>{t.nav.favorites}</Link></li>
                        <li>
                          <a
                            href="#"
                            onClick={(e) => {
                              e.preventDefault();
                              void signOut();
                            }}
                          >
                            {t.nav.logout}
                          </a>
                        </li>
                      </ul>
                    )}
                  </div>
                ) : (
                  <>
                    {/* Classes dédiées : sous 576px la barre ne garde que la
                        connexion, l'inscription restant dans le menu. Sans
                        elles, la règle toucherait aussi le bouton de compte. */}
                    <Link href={href('/login')} className="tm-navbtn tm-navbtn-ghost tm-navbtn-login">
                      {t.nav.login}
                    </Link>
                    <Link
                      href={href('/signup')}
                      className="tm-navbtn tm-navbtn-primary tm-navbtn-register"
                    >
                      {t.nav.register}
                    </Link>
                  </>
                )}

                {/* Menu mobile : dernier élément de la barre, dans le flux
                    normal — en `position: absolute` il recouvrait les
                    boutons de compte. */}
                <button
                  type="button"
                  className="tm-mobilenav-toggle"
                  aria-label="Toggle navigation"
                  aria-expanded={mobileOpen}
                  onClick={() => setMobileOpen((v) => !v)}
                >
                  <i className={mobileOpen ? 'ion-android-close' : 'ion-android-menu'} />
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Header Bottom Area — navigation */}
      <div className="tm-header-bottomarea bg-white">
        <div className="container">
          <nav className="tm-header-nav">
            <ul>
              {NAV.map((item) => (
                <li key={item.href} className={pathname === item.href ? 'current' : undefined}>
                  <Link href={item.href}>{item.label}</Link>
                </li>
              ))}
            </ul>
          </nav>
        </div>
      </div>

      {/* Navigation mobile */}
      <div className={`tm-mobilemenu${mobileOpen ? ' is-open' : ''}`}>
        <ul>
          {NAV.map((item) => (
            <li key={`m-${item.href}`}>
              <Link href={item.href}>{item.label}</Link>
            </li>
          ))}
          {isStaff && (
            <li>
              <Link href={href('/admin')}>Admin panel</Link>
            </li>
          )}
          <li>
            <Link href={href(userEmail ? '/account' : '/login')}>
              {userEmail ? t.nav.account : t.nav.login}
            </Link>
          </li>
          {!userEmail && (
            <li>
              <Link href={href('/signup')}>{t.nav.register}</Link>
            </li>
          )}
        </ul>
      </div>
    </div>
  );
}
