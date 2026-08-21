import Link from 'next/link';
import type { Locale } from '@/i18n/config';

type Crumb = { label: string; href?: string };

export default function Breadcrumb({
  locale,
  title,
  crumbs = [],
}: {
  locale: Locale;
  title: string;
  crumbs?: Crumb[];
}) {
  return (
    <div
      className="tm-breadcrumb-area tm-breadcrumb-social tm-padding-section"
      style={{ backgroundImage: 'url(/assets/images/bgImage.png)' }}
    >
      <div className="container">
        <div className="tm-breadcrumb" data-motion="head">
          <h2>{title}</h2>
          <ul>
            <li>
              <Link href={`/${locale}`}>Home</Link>
            </li>
            {crumbs.map((c) => (
              <li key={c.label}>{c.href ? <Link href={c.href}>{c.label}</Link> : c.label}</li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}
