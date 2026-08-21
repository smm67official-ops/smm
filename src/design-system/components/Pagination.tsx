'use client';

import Icon from '@/design-system/components/Icon';

export type PaginationProps = {
  page: number;
  pageCount: number;
  onChange: (page: number) => void;
  siblings?: number;
};

/** Construit la fenêtre de pages : 1 … 4 5 [6] 7 8 … 20 */
function buildRange(page: number, pageCount: number, siblings: number): Array<number | 'gap'> {
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

export default function Pagination({ page, pageCount, onChange, siblings = 1 }: PaginationProps) {
  if (pageCount <= 1) return null;

  return (
    <nav className="sv-pagination" aria-label="Pagination">
      <button
        type="button"
        className="sv-pagination__item"
        disabled={page === 1}
        onClick={() => onChange(page - 1)}
        aria-label="Previous page"
      >
        <Icon name="chevronLeft" size={16} />
      </button>

      {buildRange(page, pageCount, siblings).map((entry, index) =>
        entry === 'gap' ? (
          <span key={`gap-${index}`} className="sv-pagination__ellipsis">
            …
          </span>
        ) : (
          <button
            key={entry}
            type="button"
            className={`sv-pagination__item${entry === page ? ' sv-pagination__item--active' : ''}`}
            aria-current={entry === page ? 'page' : undefined}
            onClick={() => onChange(entry)}
          >
            {entry}
          </button>
        )
      )}

      <button
        type="button"
        className="sv-pagination__item"
        disabled={page === pageCount}
        onClick={() => onChange(page + 1)}
        aria-label="Next page"
      >
        <Icon name="chevronRight" size={16} />
      </button>
    </nav>
  );
}
