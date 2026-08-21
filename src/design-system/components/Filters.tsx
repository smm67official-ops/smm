'use client';

import Icon from '@/design-system/components/Icon';
import Select, { type SelectOption } from '@/design-system/components/Select';
import { SV_PLATFORMS, platformStyle, type SvPlatform } from '@/design-system/platforms';

export type FiltersValue = {
  query: string;
  platforms: SvPlatform[];
  sort: string;
  minPrice?: string;
  maxPrice?: string;
};

export type FiltersProps = {
  value: FiltersValue;
  onChange: (next: FiltersValue) => void;
  sortOptions?: SelectOption[];
  labels?: { search?: string; sort?: string; min?: string; max?: string; reset?: string };
};

const DEFAULT_SORT: SelectOption[] = [
  { value: 'relevance', label: 'Most relevant' },
  { value: 'price-asc', label: 'Price: low to high' },
  { value: 'price-desc', label: 'Price: high to low' },
  { value: 'followers', label: 'Most followers' },
];

export default function Filters({ value, onChange, sortOptions = DEFAULT_SORT, labels }: FiltersProps) {
  const t = {
    search: labels?.search ?? 'Search accounts, niches, handles…',
    sort: labels?.sort ?? 'Sort by',
    min: labels?.min ?? 'Min price',
    max: labels?.max ?? 'Max price',
    reset: labels?.reset ?? 'Reset',
  };

  const togglePlatform = (platform: SvPlatform) => {
    const platforms = value.platforms.includes(platform)
      ? value.platforms.filter((p) => p !== platform)
      : [...value.platforms, platform];
    onChange({ ...value, platforms });
  };

  return (
    <div className="sv-filters">
      <div className="sv-filters__row">
        <div className="sv-filters__search">
          <div className="sv-input-wrap">
            <span className="sv-input-wrap__icon">
              <Icon name="search" size={16} />
            </span>
            <input
              className="sv-input"
              type="search"
              placeholder={t.search}
              aria-label={t.search}
              value={value.query}
              onChange={(e) => onChange({ ...value, query: e.target.value })}
            />
          </div>
        </div>

        <div style={{ width: 190 }}>
          <Select
            aria-label={t.sort}
            options={sortOptions}
            value={value.sort}
            onChange={(e) => onChange({ ...value, sort: e.target.value })}
          />
        </div>

        <input
          className="sv-input"
          style={{ width: 120 }}
          type="number"
          min={0}
          placeholder={t.min}
          aria-label={t.min}
          value={value.minPrice ?? ''}
          onChange={(e) => onChange({ ...value, minPrice: e.target.value })}
        />
        <input
          className="sv-input"
          style={{ width: 120 }}
          type="number"
          min={0}
          placeholder={t.max}
          aria-label={t.max}
          value={value.maxPrice ?? ''}
          onChange={(e) => onChange({ ...value, maxPrice: e.target.value })}
        />
      </div>

      <div className="sv-filters__row">
        {(Object.keys(SV_PLATFORMS) as SvPlatform[]).map((platform) => {
          const active = value.platforms.includes(platform);
          return (
            <button
              key={platform}
              type="button"
              aria-pressed={active}
              className={`sv-chip${active ? ' sv-chip--active' : ''}`}
              style={platformStyle(platform)}
              onClick={() => togglePlatform(platform)}
            >
              <span className="sv-chip__dot" />
              {SV_PLATFORMS[platform].label}
            </button>
          );
        })}

        {(value.platforms.length > 0 || value.query) && (
          <button
            type="button"
            className="sv-chip"
            onClick={() => onChange({ ...value, query: '', platforms: [], minPrice: '', maxPrice: '' })}
          >
            <Icon name="close" size={12} />
            {t.reset}
          </button>
        )}
      </div>
    </div>
  );
}
