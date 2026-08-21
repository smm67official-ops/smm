'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { Icon } from '@/design-system';

const PAGE_SIZES = [10, 20, 50, 100];

/** Fenêtre de pages : 1 … 4 5 [6] 7 8 … 20 */
function buildRange(page: number, pageCount: number, siblings = 1): Array<number | 'gap'> {
  const total = siblings * 2 + 5;
  if (pageCount <= total) return Array.from({ length: pageCount }, (_, i) => i + 1);

  const left = Math.max(page - siblings, 1);
  const right = Math.min(page + siblings, pageCount);
  const range: Array<number | 'gap'> = [1];

  if (left > 2) range.push('gap');
  for (let i = Math.max(left, 2); i <= Math.min(right, pageCount - 1); i += 1) range.push(i);
  if (right < pageCount - 1) range.push('gap');
  range.push(pageCount);

  return range;
}

/**
 * Pagination avec sélecteur de taille de page.
 * Les filtres présents dans l'URL sont préservés à chaque navigation.
 */
export default function TablePagination({
  basePath,
  page,
  perPage,
  total,
}: {
  basePath: string;
  page: number;
  perPage: number;
  total: number;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const pageCount = Math.max(1, Math.ceil(total / perPage));
  const from = total === 0 ? 0 : (page - 1) * perPage + 1;
  const to = Math.min(page * perPage, total);

  const go = (mutate: (p: URLSearchParams) => void) => {
    const params = new URLSearchParams(searchParams.toString());
    mutate(params);
    const qs = params.toString();
    router.push(qs ? `${basePath}?${qs}` : basePath);
  };

  return (
    <div className="ct__pagination">
      <div className="ct__pagination-size">
        <span className="ct__pagination-label">Rows per page</span>
        <select
          className="ct__pagination-select"
          aria-label="Rows per page"
          value={perPage}
          onChange={(e) =>
            go((p) => {
              p.set('per', e.target.value);
              p.delete('page');
            })
          }
        >
          {PAGE_SIZES.map((size) => (
            <option key={size} value={size}>
              {size}
            </option>
          ))}
        </select>
        <span className="ct__pagination-label">
          {from}–{to} of {total.toLocaleString()}
        </span>
      </div>

      <nav className="ct__pagination-pages" aria-label="Pagination">
        <button
          type="button"
          className="ct__page-btn"
          disabled={page <= 1}
          aria-label="Previous page"
          onClick={() => go((p) => p.set('page', String(page - 1)))}
        >
          <Icon name="chevronLeft" size={15} />
        </button>

        {buildRange(page, pageCount).map((entry, index) =>
          entry === 'gap' ? (
            <span key={`gap-${index}`} className="ct__page-gap">
              …
            </span>
          ) : (
            <button
              key={entry}
              type="button"
              className={`ct__page-btn${entry === page ? ' is-active' : ''}`}
              aria-current={entry === page ? 'page' : undefined}
              onClick={() => go((p) => (entry === 1 ? p.delete('page') : p.set('page', String(entry))))}
            >
              {entry}
            </button>
          )
        )}

        <button
          type="button"
          className="ct__page-btn"
          disabled={page >= pageCount}
          aria-label="Next page"
          onClick={() => go((p) => p.set('page', String(page + 1)))}
        >
          <Icon name="chevronRight" size={15} />
        </button>
      </nav>
    </div>
  );
}
