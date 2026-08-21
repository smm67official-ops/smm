import Link from 'next/link';
import type { ReactNode } from 'react';
import Icon from '@/design-system/components/Icon';

export type FooterColumn = { title: string; links: Array<{ label: string; href: string }> };

export type FooterProps = {
  brand?: ReactNode;
  description?: ReactNode;
  columns: FooterColumn[];
  bottom?: ReactNode;
  legal?: ReactNode;
};

export default function Footer({ brand = 'SocialVault', description, columns, bottom, legal }: FooterProps) {
  return (
    <footer className="sv-footer">
      <div className="sv-container">
        <div className="sv-footer__grid">
          <div>
            <Link href="/" className="sv-navbar__brand" style={{ marginBottom: 'var(--sv-space-4)' }}>
              <span className="sv-navbar__mark">
                <Icon name="shield" size={18} />
              </span>
              {brand}
            </Link>
            {description && <p className="sv-caption" style={{ maxWidth: '38ch' }}>{description}</p>}
          </div>

          {columns.map((column) => (
            <div key={column.title}>
              <h4 className="sv-footer__title">{column.title}</h4>
              <ul className="sv-footer__list">
                {column.links.map((link) => (
                  <li key={link.href + link.label}>
                    <Link href={link.href}>{link.label}</Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="sv-footer__bottom">
          <span>{bottom ?? `© ${new Date().getFullYear()} SocialVault. All rights reserved.`}</span>
          {legal}
        </div>
      </div>
    </footer>
  );
}
