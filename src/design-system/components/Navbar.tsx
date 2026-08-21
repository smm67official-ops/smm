'use client';

import Link from 'next/link';
import { useState, type ReactNode } from 'react';
import Button from '@/design-system/components/Button';
import Icon from '@/design-system/components/Icon';

export type NavLink = { label: string; href: string; active?: boolean };

export type NavbarProps = {
  brand?: ReactNode;
  brandHref?: string;
  links: NavLink[];
  actions?: ReactNode;
};

export default function Navbar({ brand = 'SocialVault', brandHref = '/', links, actions }: NavbarProps) {
  const [open, setOpen] = useState(false);

  return (
    <header className="sv-navbar">
      <div className="sv-container sv-navbar__inner">
        <Link href={brandHref} className="sv-navbar__brand">
          <span className="sv-navbar__mark">
            <Icon name="shield" size={18} />
          </span>
          {brand}
        </Link>

        <nav>
          <ul className="sv-navbar__links">
            {links.map((link) => (
              <li key={link.href}>
                <Link
                  href={link.href}
                  className={`sv-navbar__link${link.active ? ' sv-navbar__link--active' : ''}`}
                >
                  {link.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>

        <div className="sv-navbar__actions">
          {actions}
          <Button
            variant="ghost"
            iconOnly
            className="sv-navbar__toggle"
            aria-label="Toggle menu"
            aria-expanded={open}
            onClick={() => setOpen((v) => !v)}
            leadingIcon={<Icon name={open ? 'close' : 'menu'} size={20} />}
          />
        </div>
      </div>

      {open && (
        <div
          className="sv-card"
          style={{
            position: 'absolute',
            insetInline: 'var(--sv-space-4)',
            top: 'calc(var(--sv-navbar-height) + var(--sv-space-2))',
            padding: 'var(--sv-space-3)',
          }}
        >
          {links.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="sv-menu__item"
              onClick={() => setOpen(false)}
            >
              {link.label}
            </Link>
          ))}
        </div>
      )}
    </header>
  );
}
