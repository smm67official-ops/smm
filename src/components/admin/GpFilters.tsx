'use client';

import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Icon } from '@/design-system';

export type FilterField =
  | { type: 'search'; name: string; label: string; placeholder?: string }
  | { type: 'select'; name: string; label: string; options: Array<{ value: string; label: string }> };

/**
 * Panneau de filtres du back-office.
 * Chaque champ est piloté par l'URL : les filtres survivent au partage
 * du lien, au rafraîchissement et à la pagination.
 */
export default function GpFilters({
  basePath,
  fields,
  children,
}: {
  basePath: string;
  fields: FilterField[];
  children?: React.ReactNode;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [values, setValues] = useState<Record<string, string>>({});

  // Synchronisation quand l'URL change (retour arrière, lien externe…).
  useEffect(() => {
    const next: Record<string, string> = {};
    fields.forEach((field) => {
      next[field.name] = searchParams.get(field.name) ?? (field.type === 'select' ? 'all' : '');
    });
    setValues(next);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  const apply = (overrides: Record<string, string> = {}) => {
    const params = new URLSearchParams(searchParams.toString());
    const merged = { ...values, ...overrides };

    fields.forEach((field) => {
      const value = merged[field.name];
      if (!value || value === 'all') params.delete(field.name);
      else params.set(field.name, value);
    });

    params.delete('page'); // tout changement de filtre repart de la page 1
    const qs = params.toString();
    router.push(qs ? `${basePath}?${qs}` : basePath);
  };

  const hasFilters = fields.some((field) => {
    const value = searchParams.get(field.name);
    return value && value !== 'all';
  });

  return (
    <form
      className="gp-filters"
      onSubmit={(e) => {
        e.preventDefault();
        apply();
      }}
    >
      <div className="gp-filters__grid">
        {fields.map((field) => (
          <div className="gp-field" key={field.name}>
            <label className="gp-label" htmlFor={`filter-${field.name}`}>
              {field.label}
            </label>

            {field.type === 'search' ? (
              <div className="gp-input-icon">
                <Icon name="search" size={15} />
                <input
                  id={`filter-${field.name}`}
                  className="gp-input"
                  type="search"
                  placeholder={field.placeholder}
                  value={values[field.name] ?? ''}
                  onChange={(e) => setValues((v) => ({ ...v, [field.name]: e.target.value }))}
                />
              </div>
            ) : (
              <select
                id={`filter-${field.name}`}
                className="gp-select"
                value={values[field.name] ?? 'all'}
                onChange={(e) => {
                  setValues((v) => ({ ...v, [field.name]: e.target.value }));
                  apply({ [field.name]: e.target.value });
                }}
              >
                {field.options.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            )}
          </div>
        ))}
      </div>

      <div className="gp-filters__actions">
        <button type="submit" className="gp-btn gp-btn--primary gp-btn--sm">
          <Icon name="filter" size={14} />
          Apply
        </button>

        {hasFilters && (
          <button type="button" className="gp-btn gp-btn--sm" onClick={() => router.push(basePath)}>
            <Icon name="close" size={14} />
            Reset
          </button>
        )}

        {children}
      </div>
    </form>
  );
}
