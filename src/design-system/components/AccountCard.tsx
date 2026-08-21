import Avatar from '@/design-system/components/Avatar';
import Badge from '@/design-system/components/Badge';
import Button from '@/design-system/components/Button';
import Icon from '@/design-system/components/Icon';
import { SV_PLATFORMS, platformStyle, type SvPlatform } from '@/design-system/platforms';

export type SocialAccount = {
  id: string;
  handle: string;
  platform: SvPlatform;
  category: string;
  avatar?: string;
  verified?: boolean;
  followers: number;
  engagement: number; // en %
  posts: number;
  price: number;
  currency?: string;
  quality?: 'premium' | 'standard' | 'starter';
  seller: { name: string; rating: number; sales: number; avatar?: string };
};

const compact = (value: number) =>
  new Intl.NumberFormat('en', { notation: 'compact', maximumFractionDigits: 1 }).format(value);

const QUALITY_TONE = {
  premium: 'gradient',
  standard: 'info',
  starter: 'neutral',
} as const;

export default function AccountCard({
  account,
  onView,
  onBuy,
  labels,
}: {
  account: SocialAccount;
  onView?: (id: string) => void;
  onBuy?: (id: string) => void;
  labels?: { followers?: string; engagement?: string; posts?: string; buy?: string; view?: string; sales?: string };
}) {
  const t = {
    followers: labels?.followers ?? 'Followers',
    engagement: labels?.engagement ?? 'Engagement',
    posts: labels?.posts ?? 'Posts',
    buy: labels?.buy ?? 'Buy now',
    view: labels?.view ?? 'View',
    sales: labels?.sales ?? 'sales',
  };

  return (
    <article className="sv-account" style={platformStyle(account.platform)}>
      <header className="sv-account__head">
        <Avatar src={account.avatar} name={account.handle} size="lg" verified={account.verified} ring />
        <div className="sv-account__identity">
          <div className="sv-account__handle">
            <span>{account.handle}</span>
          </div>
          <span className="sv-account__category">{account.category}</span>
        </div>
        <span className="sv-account__platform" style={{ marginInlineStart: 'auto' }} title={SV_PLATFORMS[account.platform].label}>
          <Icon name="users" size={18} />
        </span>
      </header>

      <div className="sv-row">
        {account.quality && (
          <Badge tone={QUALITY_TONE[account.quality]}>{account.quality.toUpperCase()}</Badge>
        )}
        {account.verified && (
          <Badge tone="success" icon={<Icon name="shield" size={12} />}>
            Verified
          </Badge>
        )}
        <Badge tone="outline">{SV_PLATFORMS[account.platform].label}</Badge>
      </div>

      <div className="sv-account__metrics">
        <div className="sv-account__metric">
          <b>{compact(account.followers)}</b>
          <span>{t.followers}</span>
        </div>
        <div className="sv-account__metric">
          <b>{account.engagement.toFixed(1)}%</b>
          <span>{t.engagement}</span>
        </div>
        <div className="sv-account__metric">
          <b>{compact(account.posts)}</b>
          <span>{t.posts}</span>
        </div>
      </div>

      <div className="sv-seller">
        <Avatar src={account.seller.avatar} name={account.seller.name} size="sm" />
        <span>{account.seller.name}</span>
        <span className="sv-seller__rating">
          <Icon name="star" size={12} fill="currentColor" />
          {account.seller.rating.toFixed(1)}
        </span>
        <span className="sv-caption">
          · {account.seller.sales} {t.sales}
        </span>
      </div>

      <footer className="sv-account__foot">
        <div className="sv-account__price">
          <b>
            {account.currency ?? '$'}
            {account.price.toLocaleString()}
          </b>
          <span>{t.buy}</span>
        </div>
        <div className="sv-row" style={{ flexWrap: 'nowrap' }}>
          <Button variant="secondary" size="sm" onClick={() => onView?.(account.id)}>
            {t.view}
          </Button>
          <Button size="sm" onClick={() => onBuy?.(account.id)} trailingIcon={<Icon name="arrowRight" size={14} />}>
            {t.buy}
          </Button>
        </div>
      </footer>
    </article>
  );
}
