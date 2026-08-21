'use client';

import Link from 'next/link';
import { useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { PLATFORMS } from '@/lib/platforms';
import type { Locale } from '@/i18n/config';
import type { Dictionary } from '@/i18n';
import type { ServiceCategory } from '@/lib/supabase/types';

export default function ServiceFilters({
  locale,
  t,
  categories,
}: {
  locale: Locale;
  t: Dictionary;
  categories: ServiceCategory[];
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [term, setTerm] = useState(searchParams.get('q') ?? '');

  const activePlatform = searchParams.get('platform');

  const push = (mutate: (p: URLSearchParams) => void) => {
    const params = new URLSearchParams(searchParams.toString());
    mutate(params);
    params.delete('page');
    const qs = params.toString();
    router.push(qs ? `/${locale}/services?${qs}` : `/${locale}/services`);
  };

  const platformHref = (slug: string) => {
    const params = new URLSearchParams(searchParams.toString());
    if (activePlatform === slug) params.delete('platform');
    else params.set('platform', slug);
    // Changer de plateforme invalide la catégorie sélectionnée.
    params.delete('category');
    params.delete('page');
    const qs = params.toString();
    return qs ? `/${locale}/services?${qs}` : `/${locale}/services`;
  };

  return (
    <div className="tm-servicefilters">
      {/* Filtres par plateforme */}
      <ul className="tm-platformfilter">
        {PLATFORMS.map((platform) => (
          <li key={platform.slug}>
            <Link
              href={platformHref(platform.slug)}
              className={activePlatform === platform.slug ? 'is-active' : undefined}
              title={platform.label}
            >
              <i className={platform.icon} style={{ color: platform.color }} />
              <span>{platform.label}</span>
            </Link>
          </li>
        ))}
      </ul>

      <form
        className="tm-shop-header"
        onSubmit={(e) => {
          e.preventDefault();
          push((p) => (term.trim() ? p.set('q', term.trim()) : p.delete('q')));
        }}
      >
        <div className="tm-header-search tm-servicefilters-search">
          <input
            type="text"
            placeholder={t.services.search}
            aria-label={t.services.search}
            value={term}
            onChange={(e) => setTerm(e.target.value)}
          />
          <button type="submit" aria-label={t.services.search}>
            <i className="ion-android-search" />
          </button>
        </div>

        <select
          className="tm-select"
          aria-label={t.services.allCategories}
          value={searchParams.get('category') ?? ''}
          onChange={(e) =>
            push((p) => (e.target.value ? p.set('category', e.target.value) : p.delete('category')))
          }
        >
          <option value="">{t.services.allCategories}</option>
          {categories.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>

        <select
          className="tm-select"
          aria-label={t.services.sort}
          value={searchParams.get('sort') ?? 'default'}
          onChange={(e) => push((p) => p.set('sort', e.target.value))}
        >
          <option value="default">{t.services.sortDefault}</option>
          <option value="price-asc">{t.services.sortPriceAsc}</option>
          <option value="price-desc">{t.services.sortPriceDesc}</option>
        </select>
      </form>
    </div>
  );
}
