'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useState, type ReactNode } from 'react';
import { Avatar, Button, Icon, type IconName } from '@/design-system';
import { createClient } from '@/lib/supabase/client';

const NAV: Array<{ href: string; label: string; icon: IconName }> = [
  { href: '', label: 'Dashboard', icon: 'grid' },
  { href: '/orders', label: 'Orders', icon: 'wallet' },
  { href: '/customers', label: 'Customers', icon: 'users' },
  { href: '/topups', label: 'Top-ups', icon: 'card' },
  { href: '/services', label: 'Services', icon: 'bolt' },
];

export default function AdminShell({
  locale,
  email,
  role,
  children,
}: {
  locale: string;
  email: string;
  role: string;
  children: ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const [open, setOpen] = useState(false);

  const base = `/${locale}/admin`;

  // Le tiroir se referme dès qu'on navigue : sinon il masque la page
  // d'arrivée sur mobile.
  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  // Tiroir ouvert = page figée derrière, et Échap pour sortir.
  useEffect(() => {
    if (!open) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = previous;
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const signOut = async () => {
    await createClient().auth.signOut();
    router.push(`${base}/login`);
    router.refresh();
  };

  return (
    <div className="sv-admin">
      {/* Voile : ferme le tiroir au toucher, hors du tiroir */}
      <button
        type="button"
        className={`sv-admin__scrim${open ? ' is-open' : ''}`}
        aria-label="Close menu"
        tabIndex={open ? 0 : -1}
        onClick={() => setOpen(false)}
      />

      <aside
        className={`sv-admin__sidebar${open ? ' is-open' : ''}`}
        aria-hidden={undefined}
      >
        <Link href={base} className="sv-navbar__brand" style={{ marginBottom: 'var(--sv-space-8)' }}>
          <span className="sv-navbar__mark">
            <Icon name="shield" size={18} />
          </span>
          <span>Admin</span>
        </Link>

        <nav className="sv-admin__nav">
          {NAV.map((item) => {
            const href = `${base}${item.href}`;
            const active = item.href === '' ? pathname === base : pathname.startsWith(href);
            return (
              <Link
                key={item.href}
                href={href}
                className={`sv-admin__link${active ? ' is-active' : ''}`}
                data-tip={item.label}
                aria-current={active ? 'page' : undefined}
                onClick={() => setOpen(false)}
              >
                <Icon name={item.icon} size={18} />
                <span>{item.label}</span>
              </Link>
            );
          })}
        </nav>

        <div className="sv-admin__sidebar-foot">
          <Link href={`/${locale}`} className="sv-admin__link" data-tip="Back to site">
            <Icon name="arrowRight" size={18} />
            <span>Back to site</span>
          </Link>
          <button type="button" className="sv-admin__link" data-tip="Logout" onClick={signOut}>
            <Icon name="lock" size={18} />
            <span>Logout</span>
          </button>
        </div>
      </aside>

      <div className="sv-admin__main">
        <header className="sv-admin__topbar">
          <Button
            variant="ghost"
            iconOnly
            className="sv-admin__burger"
            aria-label="Toggle menu"
            onClick={() => setOpen((v) => !v)}
            leadingIcon={<Icon name={open ? 'close' : 'menu'} size={20} />}
          />
          <span className="sv-caption sv-admin__date">
            {new Date().toLocaleDateString('en-GB', { dateStyle: 'medium' })}
          </span>
          <div className="sv-row" style={{ marginInlineStart: 'auto', gap: 'var(--sv-space-3)' }}>
            <div className="sv-admin__identity">
              <div className="sv-admin__identity-name">{email}</div>
              <div className="sv-caption">{role}</div>
            </div>
            <Avatar name={email} />
          </div>
        </header>

        <main className="sv-admin__content">{children}</main>
      </div>
    </div>
  );
}
