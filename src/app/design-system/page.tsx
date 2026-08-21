'use client';

import { useState } from 'react';
import {
  AccountCard,
  Alert,
  Avatar,
  AvatarGroup,
  Badge,
  Button,
  Card,
  CardBody,
  CardFooter,
  CardHeader,
  Checkbox,
  Dropdown,
  Filters,
  Footer,
  Hero,
  Icon,
  Input,
  MarketplaceCard,
  Modal,
  Navbar,
  Pagination,
  PlatformBadge,
  Progress,
  Select,
  Sparkline,
  StatCard,
  Table,
  Tabs,
  Textarea,
  ActivityFeed,
  useToast,
  SV_PLATFORMS,
  type FiltersValue,
  type MarketplaceListing,
  type SocialAccount,
  type SvPlatform,
} from '@/design-system';

/* ---------------------------------------------------------
   Données de démonstration
   --------------------------------------------------------- */
const ACCOUNTS: SocialAccount[] = [
  {
    id: 'a1',
    handle: '@urban.fitness',
    platform: 'instagram',
    category: 'Fitness & Wellness',
    verified: true,
    followers: 128400,
    engagement: 6.4,
    posts: 842,
    price: 2450,
    quality: 'premium',
    seller: { name: 'Nova Media', rating: 4.9, sales: 231 },
  },
  {
    id: 'a2',
    handle: '@daily.tech',
    platform: 'tiktok',
    category: 'Tech reviews',
    followers: 89200,
    engagement: 9.1,
    posts: 410,
    price: 1780,
    quality: 'standard',
    seller: { name: 'Peak Assets', rating: 4.7, sales: 118 },
  },
  {
    id: 'a3',
    handle: '@travel.notes',
    platform: 'youtube',
    category: 'Travel vlogs',
    verified: true,
    followers: 54300,
    engagement: 4.2,
    posts: 196,
    price: 3990,
    quality: 'premium',
    seller: { name: 'Atlas Group', rating: 5.0, sales: 64 },
  },
];

const LISTINGS: MarketplaceListing[] = [
  {
    id: 'l1',
    title: 'Aged fashion community with organic growth',
    platform: 'instagram',
    followers: 214000,
    engagement: 5.8,
    age: '4 yrs',
    price: 5200,
    featured: true,
    verified: true,
    seller: { name: 'Nova Media', rating: 4.9 },
  },
  {
    id: 'l2',
    title: 'Crypto news channel, highly active audience',
    platform: 'telegram',
    followers: 47500,
    engagement: 12.3,
    age: '2 yrs',
    price: 1900,
    seller: { name: 'Peak Assets', rating: 4.7 },
  },
  {
    id: 'l3',
    title: 'Short-form comedy page with viral history',
    platform: 'tiktok',
    followers: 302000,
    engagement: 8.4,
    age: '3 yrs',
    price: 6400,
    verified: true,
    seller: { name: 'Atlas Group', rating: 5.0 },
  },
];

type TxRow = {
  id: string;
  account: string;
  platform: SvPlatform;
  buyer: string;
  amount: number;
  status: 'completed' | 'escrow' | 'pending';
  date: string;
};

const TRANSACTIONS: TxRow[] = [
  { id: 'TX-4821', account: '@urban.fitness', platform: 'instagram', buyer: 'M. Alaoui', amount: 2450, status: 'completed', date: '12 Aug 2026' },
  { id: 'TX-4820', account: '@daily.tech', platform: 'tiktok', buyer: 'S. Bennani', amount: 1780, status: 'escrow', date: '11 Aug 2026' },
  { id: 'TX-4819', account: '@travel.notes', platform: 'youtube', buyer: 'K. Idrissi', amount: 3990, status: 'pending', date: '10 Aug 2026' },
];

const STATUS_TONE = { completed: 'success', escrow: 'info', pending: 'warning' } as const;

function Section({ id, title, description, children }: { id: string; title: string; description?: string; children: React.ReactNode }) {
  return (
    <section id={id} className="sv-section" style={{ paddingBlock: 'var(--sv-space-12)' }}>
      <div className="sv-container">
        <header style={{ marginBottom: 'var(--sv-space-8)' }}>
          <span className="sv-eyebrow">{id.replace(/-/g, ' ')}</span>
          <h2>{title}</h2>
          {description && <p className="sv-lead" style={{ maxWidth: '62ch' }}>{description}</p>}
        </header>
        {children}
      </div>
    </section>
  );
}

export default function DesignSystemPage() {
  const { toast } = useToast();

  const [tab, setTab] = useState('overview');
  const [pillTab, setPillTab] = useState('all');
  const [page, setPage] = useState(3);
  const [modalOpen, setModalOpen] = useState(false);
  const [filters, setFilters] = useState<FiltersValue>({
    query: '',
    platforms: ['instagram'],
    sort: 'relevance',
    minPrice: '',
    maxPrice: '',
  });

  return (
    <>
      <Navbar
        brandHref="/design-system"
        links={[
          { label: 'Marketplace', href: '#marketplace', active: true },
          { label: 'Components', href: '#buttons' },
          { label: 'Dashboard', href: '#dashboard' },
          { label: 'Tokens', href: '#tokens' },
        ]}
        actions={
          <>
            <Button variant="ghost" size="sm">
              Sign in
            </Button>
            <Button size="sm" trailingIcon={<Icon name="arrowRight" size={14} />}>
              Get started
            </Button>
          </>
        }
      />

      {/* ---------------- Hero ---------------- */}
      <Hero
        eyebrow="Premium social marketplace"
        title={
          <>
            Buy and sell social accounts with{' '}
            <span className="sv-gradient-text">verified trust</span>
          </>
        }
        text="Every listing is audited, every payment is held in escrow, and every seller carries a public reputation. Grow faster without the guesswork."
        actions={
          <>
            <Button size="lg" trailingIcon={<Icon name="arrowRight" size={18} />}>
              Browse marketplace
            </Button>
            <Button size="lg" variant="secondary" leadingIcon={<Icon name="eye" size={18} />}>
              How it works
            </Button>
          </>
        }
        proof={
          <>
            <AvatarGroup>
              <Avatar name="Nova Media" />
              <Avatar name="Peak Assets" />
              <Avatar name="Atlas Group" />
              <Avatar name="+9" />
            </AvatarGroup>
            <div>
              <div className="sv-row" style={{ gap: 'var(--sv-space-1)', color: 'var(--sv-warning)' }}>
                {[0, 1, 2, 3, 4].map((i) => (
                  <Icon key={i} name="star" size={14} fill="currentColor" />
                ))}
              </div>
              <span className="sv-caption">4.9/5 from 1,358 verified transactions</span>
            </div>
          </>
        }
        visual={
          // eslint-disable-next-line @next/next/no-img-element
          <img src="/assets/images/hero-social.png" alt="" width={520} />
        }
        floating={
          <>
            <div className="sv-hero__floating sv-hero__floating--tl">
              <span className="sv-stat__icon">
                <Icon name="shield" size={18} />
              </span>
              <div>
                <b>Escrow protected</b>
                <span>Funds released on transfer</span>
              </div>
            </div>
            <div className="sv-hero__floating sv-hero__floating--br">
              <span className="sv-stat__icon">
                <Icon name="trendingUp" size={18} />
              </span>
              <div>
                <b>+128K followers</b>
                <span>Average verified listing</span>
              </div>
            </div>
          </>
        }
      />

      {/* ---------------- Tokens ---------------- */}
      <Section
        id="tokens"
        title="Design tokens"
        description="Une seule source de vérité : couleurs, typographie, rayons et ombres sont des variables CSS. Aucun composant ne code une valeur en dur."
      >
        <div className="sv-grid sv-grid--4">
          {[
            ['Primary', 'var(--sv-primary)', '#5B6EF5'],
            ['Primary hover', 'var(--sv-primary-hover)', '#4A5BE7'],
            ['Gradient start', 'var(--sv-gradient-start)', '#6366F1'],
            ['Gradient end', 'var(--sv-gradient-end)', '#A855F7'],
            ['Lavender', 'var(--sv-secondary-lavender)', '#C4C4F5'],
            ['Accent purple', 'var(--sv-accent-purple)', '#8B5CF6'],
            ['Accent light', 'var(--sv-accent-light)', '#D8D4FF'],
            ['Background', 'var(--sv-bg)', '#F8F8FC'],
            ['Background 2', 'var(--sv-bg-secondary)', '#EEEEFA'],
            ['Surface', 'var(--sv-surface)', '#FFFFFF'],
            ['Text primary', 'var(--sv-text)', '#101830'],
            ['Text secondary', 'var(--sv-text-secondary)', '#526080'],
            ['Border', 'var(--sv-border)', '#E2E3F2'],
            ['Success', 'var(--sv-success)', '#22C55E'],
            ['Error', 'var(--sv-error)', '#EF4444'],
            ['Warning', 'var(--sv-warning)', '#F59E0B'],
          ].map(([name, token, hex]) => (
            <Card key={name}>
              <div style={{ height: 72, background: token, borderBottom: '1px solid var(--sv-border)' }} />
              <CardBody style={{ padding: 'var(--sv-space-4)' }}>
                <div className="sv-table__strong" style={{ fontSize: 'var(--sv-text-sm)' }}>{name}</div>
                <div className="sv-caption">{hex}</div>
              </CardBody>
            </Card>
          ))}
        </div>

        <div className="sv-grid sv-grid--2" style={{ marginTop: 'var(--sv-space-8)' }}>
          <Card>
            <CardHeader title="Typography" subtitle="Plus Jakarta Sans" />
            <CardBody>
              <h1 style={{ marginBottom: 'var(--sv-space-2)' }}>H1 · Display</h1>
              <h2 style={{ marginBottom: 'var(--sv-space-2)' }}>H2 · Section title</h2>
              <h3 style={{ marginBottom: 'var(--sv-space-2)' }}>H3 · Card title</h3>
              <p>Body — regular, slate blue, 1.65 line height for comfortable reading.</p>
              <p className="sv-caption" style={{ marginBottom: 0 }}>Caption — small, muted slate.</p>
            </CardBody>
          </Card>

          <Card>
            <CardHeader title="Radius & elevation" subtitle="Doux, jamais lourd" />
            <CardBody>
              <div className="sv-row" style={{ gap: 'var(--sv-space-4)' }}>
                {[
                  ['sm', 'var(--sv-radius-sm)', 'var(--sv-shadow-xs)'],
                  ['md', 'var(--sv-radius-md)', 'var(--sv-shadow-sm)'],
                  ['lg', 'var(--sv-radius-lg)', 'var(--sv-shadow-md)'],
                  ['xl', 'var(--sv-radius-xl)', 'var(--sv-shadow-lg)'],
                ].map(([name, radius, shadow]) => (
                  <div key={name} style={{ textAlign: 'center' }}>
                    <div
                      style={{
                        width: 76,
                        height: 76,
                        borderRadius: radius,
                        boxShadow: shadow,
                        background: 'var(--sv-surface)',
                        border: '1px solid var(--sv-border)',
                        marginBottom: 'var(--sv-space-2)',
                      }}
                    />
                    <span className="sv-caption">{name}</span>
                  </div>
                ))}
              </div>
            </CardBody>
          </Card>
        </div>
      </Section>

      {/* ---------------- Buttons & badges ---------------- */}
      <Section id="buttons" title="Buttons, badges & avatars" description="États de survol marqués, transitions douces, ombre violette sur l'action principale.">
        <div className="sv-grid sv-grid--2">
          <Card>
            <CardHeader title="Buttons" />
            <CardBody>
              <div className="sv-stack">
                <div className="sv-row">
                  <Button>Primary</Button>
                  <Button variant="secondary">Secondary</Button>
                  <Button variant="ghost">Ghost</Button>
                  <Button variant="danger">Danger</Button>
                </div>
                <div className="sv-row">
                  <Button size="sm">Small</Button>
                  <Button>Medium</Button>
                  <Button size="lg">Large</Button>
                </div>
                <div className="sv-row">
                  <Button leadingIcon={<Icon name="plus" size={16} />}>With icon</Button>
                  <Button loading>Loading</Button>
                  <Button disabled>Disabled</Button>
                  <Button iconOnly variant="secondary" aria-label="Filter" leadingIcon={<Icon name="filter" size={18} />} />
                </div>
              </div>
            </CardBody>
          </Card>

          <Card>
            <CardHeader title="Badges & avatars" />
            <CardBody>
              <div className="sv-stack">
                <div className="sv-row">
                  <Badge tone="neutral">Neutral</Badge>
                  <Badge tone="info">Info</Badge>
                  <Badge tone="success" dot>Live</Badge>
                  <Badge tone="warning">Pending</Badge>
                  <Badge tone="error">Rejected</Badge>
                  <Badge tone="gradient">Featured</Badge>
                  <Badge tone="outline">Outline</Badge>
                </div>
                <div className="sv-row">
                  {(Object.keys(SV_PLATFORMS) as SvPlatform[]).map((p) => (
                    <PlatformBadge key={p} platform={p} />
                  ))}
                </div>
                <div className="sv-row">
                  <Avatar name="Nova Media" size="sm" />
                  <Avatar name="Peak Assets" />
                  <Avatar name="Atlas Group" size="lg" verified ring />
                  <AvatarGroup>
                    <Avatar name="A B" />
                    <Avatar name="C D" />
                    <Avatar name="+7" />
                  </AvatarGroup>
                </div>
              </div>
            </CardBody>
          </Card>
        </div>
      </Section>

      {/* ---------------- Forms ---------------- */}
      <Section id="forms" title="Inputs, selects & feedback">
        <div className="sv-grid sv-grid--2">
          <Card>
            <CardHeader title="Form controls" />
            <CardBody>
              <div className="sv-stack" style={{ gap: 'var(--sv-space-5)' }}>
                <Input label="Account handle" placeholder="@yourhandle" icon={<Icon name="search" size={16} />} hint="Public handle, without the platform URL." />
                <Input label="Asking price" type="number" placeholder="2450" />
                <Select
                  label="Platform"
                  placeholder="Select a platform"
                  defaultValue=""
                  options={(Object.keys(SV_PLATFORMS) as SvPlatform[]).map((p) => ({
                    value: p,
                    label: SV_PLATFORMS[p].label,
                  }))}
                />
                <Input label="Email" type="email" defaultValue="not-an-email" error="Enter a valid email address." />
                <Textarea label="Description" placeholder="Audience, growth history, monetisation…" />
                <Checkbox label="I confirm I own this account and can transfer it." />
              </div>
            </CardBody>
            <CardFooter>
              <Button variant="secondary">Cancel</Button>
              <Button>Publish listing</Button>
            </CardFooter>
          </Card>

          <div className="sv-stack" style={{ gap: 'var(--sv-space-6)' }}>
            <Card>
              <CardHeader title="Alerts" />
              <CardBody>
                <div className="sv-stack">
                  <Alert tone="info" title="Escrow enabled">Funds are released once the transfer is confirmed by both parties.</Alert>
                  <Alert tone="success" title="Listing approved">Your account is now visible in the marketplace.</Alert>
                  <Alert tone="warning" title="Verification pending">Upload your ownership proof to unlock instant payouts.</Alert>
                  <Alert tone="error" title="Payment failed">Your card was declined. Try another payment method.</Alert>
                </div>
              </CardBody>
            </Card>

            <Card>
              <CardHeader title="Toasts & modal" subtitle="Notifications non bloquantes et dialogue" />
              <CardBody>
                <div className="sv-row">
                  <Button variant="secondary" size="sm" onClick={() => toast({ tone: 'success', title: 'Listing saved', description: 'Your changes are live.' })}>
                    Success toast
                  </Button>
                  <Button variant="secondary" size="sm" onClick={() => toast({ tone: 'error', title: 'Transfer failed', description: 'Retry in a few minutes.' })}>
                    Error toast
                  </Button>
                  <Button variant="secondary" size="sm" onClick={() => toast({ tone: 'info', title: 'New offer received' })}>
                    Info toast
                  </Button>
                  <Button size="sm" onClick={() => setModalOpen(true)}>Open modal</Button>
                </div>
              </CardBody>
            </Card>
          </div>
        </div>
      </Section>

      {/* ---------------- Marketplace ---------------- */}
      <Section
        id="marketplace"
        title="Marketplace"
        description="Filtres, cartes de compte et cartes d'annonce. Les couleurs de plateforme n'apparaissent qu'en accent d'identification."
      >
        <Filters value={filters} onChange={setFilters} />

        <div style={{ marginTop: 'var(--sv-space-6)' }}>
          <Tabs
            variant="pill"
            value={pillTab}
            onChange={setPillTab}
            items={[
              { id: 'all', label: 'All listings' },
              { id: 'verified', label: 'Verified' },
              { id: 'featured', label: 'Featured' },
              { id: 'ending', label: 'Ending soon' },
            ]}
          />
        </div>

        <div className="sv-grid sv-grid--3" style={{ marginTop: 'var(--sv-space-6)' }}>
          {LISTINGS.map((listing) => (
            <MarketplaceCard key={listing.id} listing={listing} onSelect={() => setModalOpen(true)} />
          ))}
        </div>

        <h3 style={{ marginTop: 'var(--sv-space-12)' }}>Account cards</h3>
        <div className="sv-grid sv-grid--3">
          {ACCOUNTS.map((account) => (
            <AccountCard key={account.id} account={account} onBuy={() => setModalOpen(true)} />
          ))}
        </div>

        <div className="sv-row" style={{ justifyContent: 'center', marginTop: 'var(--sv-space-10)' }}>
          <Pagination page={page} pageCount={12} onChange={setPage} />
        </div>
      </Section>

      {/* ---------------- Dashboard ---------------- */}
      <Section id="dashboard" title="Dashboard" description="Indicateurs, tendances, tableaux de transactions et activité récente.">
        <Tabs
          value={tab}
          onChange={setTab}
          items={[
            { id: 'overview', label: 'Overview' },
            { id: 'listings', label: 'My listings', badge: <Badge tone="info">12</Badge> },
            { id: 'orders', label: 'Orders' },
            { id: 'payouts', label: 'Payouts' },
          ]}
        />

        <div className="sv-grid sv-grid--4" style={{ marginTop: 'var(--sv-space-6)' }}>
          <StatCard
            label="Total volume"
            value="$248,900"
            icon={<Icon name="wallet" size={18} />}
            trend={{ direction: 'up', value: '+12.4%' }}
            caption="vs last month"
            chart={<Sparkline points={[8, 12, 9, 16, 14, 22, 19, 27]} />}
          />
          <StatCard
            label="Active listings"
            value="1,284"
            icon={<Icon name="grid" size={18} />}
            trend={{ direction: 'up', value: '+38' }}
            caption="this week"
          />
          <StatCard
            label="Escrow held"
            value="$36,410"
            icon={<Icon name="lock" size={18} />}
            caption="8 transactions"
          />
          <StatCard
            label="Dispute rate"
            value="0.4%"
            icon={<Icon name="shield" size={18} />}
            trend={{ direction: 'down', value: '-0.2pt' }}
            caption="vs last quarter"
          />
        </div>

        <div className="sv-grid" style={{ gridTemplateColumns: '2fr 1fr', marginTop: 'var(--sv-space-6)' }}>
          <Card>
            <CardHeader
              title="Recent transactions"
              subtitle="Escrow status per order"
              action={
                <Dropdown
                  align="end"
                  trigger={({ toggle }) => (
                    <Button variant="secondary" size="sm" onClick={toggle} trailingIcon={<Icon name="chevronDown" size={14} />}>
                      Actions
                    </Button>
                  )}
                  items={[
                    { type: 'label', id: 'l', label: 'Export' },
                    { type: 'item', id: 'csv', label: 'Download CSV', icon: <Icon name="arrowRight" size={14} /> },
                    { type: 'item', id: 'pdf', label: 'Download PDF', icon: <Icon name="arrowRight" size={14} /> },
                    { type: 'divider', id: 'd' },
                    { type: 'item', id: 'cancel', label: 'Cancel selected', danger: true, icon: <Icon name="close" size={14} /> },
                  ]}
                />
              }
            />
            <CardBody style={{ padding: 0 }}>
              <Table<TxRow>
                className="sv-table-wrap"
                rowKey={(row) => row.id}
                rows={TRANSACTIONS}
                columns={[
                  { key: 'id', header: 'Order', render: (row) => <span className="sv-table__strong">{row.id}</span> },
                  {
                    key: 'account',
                    header: 'Account',
                    render: (row) => (
                      <span className="sv-row" style={{ gap: 'var(--sv-space-2)' }}>
                        <PlatformBadge platform={row.platform} />
                        {row.account}
                      </span>
                    ),
                  },
                  { key: 'buyer', header: 'Buyer', render: (row) => row.buyer },
                  { key: 'date', header: 'Date', render: (row) => row.date },
                  {
                    key: 'status',
                    header: 'Status',
                    render: (row) => <Badge tone={STATUS_TONE[row.status]}>{row.status}</Badge>,
                  },
                  {
                    key: 'amount',
                    header: 'Amount',
                    numeric: true,
                    render: (row) => <span className="sv-table__strong">${row.amount.toLocaleString()}</span>,
                  },
                ]}
              />
            </CardBody>
          </Card>

          <div className="sv-stack" style={{ gap: 'var(--sv-space-6)' }}>
            <Card>
              <CardHeader title="Seller reputation" />
              <CardBody>
                <div className="sv-stack" style={{ gap: 'var(--sv-space-5)' }}>
                  <Progress value={92} label="Response rate" />
                  <Progress value={78} label="Completed transfers" />
                  <Progress value={46} label="Profile completion" />
                </div>
              </CardBody>
            </Card>

            <Card>
              <CardHeader title="Activity" />
              <CardBody style={{ paddingBlock: 0 }}>
                <ActivityFeed
                  items={[
                    { id: '1', icon: <Icon name="bolt" size={16} />, title: 'New offer on @urban.fitness', time: '2 minutes ago', trailing: <Badge tone="info">$2,300</Badge> },
                    { id: '2', icon: <Icon name="shield" size={16} />, title: 'Escrow released for TX-4821', time: '1 hour ago', trailing: <Badge tone="success">Paid</Badge> },
                    { id: '3', icon: <Icon name="users" size={16} />, title: 'Audit completed on @daily.tech', time: 'Yesterday' },
                  ]}
                />
              </CardBody>
            </Card>
          </div>
        </div>
      </Section>

      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title="Confirm purchase"
        description="Funds are held in escrow until the account transfer is confirmed."
        footer={
          <>
            <Button variant="secondary" onClick={() => setModalOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={() => {
                setModalOpen(false);
                toast({ tone: 'success', title: 'Payment secured', description: 'The seller has been notified.' });
              }}
            >
              Pay $2,450
            </Button>
          </>
        }
      >
        <div className="sv-stack">
          <Alert tone="info">You can open a dispute for 14 days after the transfer.</Alert>
          <Input label="Billing email" type="email" defaultValue="billing@example.com" />
          <Checkbox label="I accept the marketplace terms and the escrow policy." defaultChecked />
        </div>
      </Modal>

      <Footer
        description="The premium marketplace for buying and selling social media accounts, with escrow protection and verified sellers."
        columns={[
          {
            title: 'Marketplace',
            links: [
              { label: 'Browse listings', href: '#marketplace' },
              { label: 'Sell an account', href: '#forms' },
              { label: 'Pricing', href: '#tokens' },
            ],
          },
          {
            title: 'Trust',
            links: [
              { label: 'Escrow', href: '#dashboard' },
              { label: 'Verification', href: '#marketplace' },
              { label: 'Disputes', href: '#dashboard' },
            ],
          },
          {
            title: 'Company',
            links: [
              { label: 'About', href: '#tokens' },
              { label: 'Contact', href: '#forms' },
              { label: 'Legal', href: '#tokens' },
            ],
          },
        ]}
        legal={
          <span className="sv-row" style={{ gap: 'var(--sv-space-4)' }}>
            <a href="#tokens">Privacy</a>
            <a href="#tokens">Terms</a>
          </span>
        }
      />
    </>
  );
}
