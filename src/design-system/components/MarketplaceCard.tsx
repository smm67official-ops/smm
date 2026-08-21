import type { ReactNode } from 'react';
import Badge, { PlatformBadge } from '@/design-system/components/Badge';
import Button from '@/design-system/components/Button';
import Icon from '@/design-system/components/Icon';
import Avatar from '@/design-system/components/Avatar';
import { platformStyle, type SvPlatform } from '@/design-system/platforms';

export type MarketplaceListing = {
  id: string;
  title: string;
  platform: SvPlatform;
  followers: number;
  engagement: number;
  age: string;
  price: number;
  currency?: string;
  featured?: boolean;
  verified?: boolean;
  seller: { name: string; rating: number; avatar?: string };
};

const compact = (value: number) =>
  new Intl.NumberFormat('en', { notation: 'compact', maximumFractionDigits: 1 }).format(value);

export default function MarketplaceCard({
  listing,
  cover,
  onSelect,
  labels,
}: {
  listing: MarketplaceListing;
  cover?: ReactNode;
  onSelect?: (id: string) => void;
  labels?: { followers?: string; engagement?: string; age?: string; cta?: string };
}) {
  const t = {
    followers: labels?.followers ?? 'followers',
    engagement: labels?.engagement ?? 'engagement',
    age: labels?.age ?? 'age',
    cta: labels?.cta ?? 'View listing',
  };

  return (
    <article
      className="sv-card sv-card--interactive sv-listing"
      style={platformStyle(listing.platform)}
    >
      <div className="sv-listing__cover">
        <div className="sv-listing__tags">
          {listing.featured && <Badge tone="gradient">Featured</Badge>}
          {listing.verified && (
            <Badge tone="success" icon={<Icon name="shield" size={12} />}>
              Verified
            </Badge>
          )}
        </div>
        {cover ?? (
          <span className="sv-listing__cover-icon">
            <Icon name="users" size={30} />
          </span>
        )}
      </div>

      <div className="sv-listing__body">
        <div className="sv-row">
          <PlatformBadge platform={listing.platform} />
        </div>

        <h3 className="sv-listing__title">{listing.title}</h3>

        <div className="sv-listing__meta">
          <span>
            <b>{compact(listing.followers)}</b> {t.followers}
          </span>
          <span>
            <b>{listing.engagement.toFixed(1)}%</b> {t.engagement}
          </span>
          <span>
            <b>{listing.age}</b> {t.age}
          </span>
        </div>

        <div className="sv-row" style={{ justifyContent: 'space-between' }}>
          <span className="sv-seller">
            <Avatar src={listing.seller.avatar} name={listing.seller.name} size="sm" />
            {listing.seller.name}
            <span className="sv-seller__rating">
              <Icon name="star" size={12} fill="currentColor" />
              {listing.seller.rating.toFixed(1)}
            </span>
          </span>
          <strong style={{ fontSize: 'var(--sv-text-h4)', color: 'var(--sv-text)' }}>
            {listing.currency ?? '$'}
            {listing.price.toLocaleString()}
          </strong>
        </div>

        <Button block onClick={() => onSelect?.(listing.id)} trailingIcon={<Icon name="arrowRight" size={16} />}>
          {t.cta}
        </Button>
      </div>
    </article>
  );
}
