'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useBasket } from '@/components/providers/BasketProvider';
import { money } from '@/lib/format';
import type { Locale } from '@/i18n/config';
import type { Dictionary } from '@/i18n';
import type { Service } from '@/lib/supabase/types';

/** Champs supplémentaires attendus selon le `type` du service (API v2, §4). */
const EXTRA_FIELDS: Record<string, Array<'comments' | 'usernames' | 'hashtags' | 'hashtag' | 'username' | 'media' | 'answer_number' | 'groups' | 'webtraffic'>> = {
  'Custom Comments': ['comments'],
  'Custom Comments Package': ['comments'],
  Mentions: ['usernames'],
  'Mentions with Hashtags': ['usernames', 'hashtags'],
  'Mentions Custom List': ['usernames'],
  'Mentions Hashtag': ['hashtag'],
  'Mentions User Followers': ['username'],
  'Mentions Media Likers': ['media'],
  'Comment Likes': ['username'],
  Poll: ['answer_number'],
  'Invites from Groups': ['groups'],
  'Web Traffic': ['webtraffic'],
};

const DEVICES = [
  { value: '1', label: 'Desktop' },
  { value: '2', label: 'Mobile (Android)' },
  { value: '3', label: 'Mobile (iOS)' },
  { value: '4', label: 'Mixed (Mobile)' },
  { value: '5', label: 'Mixed (Mobile & Desktop)' },
];

const TRAFFIC_TYPES = [
  { value: '1', label: 'Google Keyword' },
  { value: '2', label: 'Custom Referrer' },
  { value: '3', label: 'Blank Referrer' },
];

export default function OrderForm({
  locale,
  t,
  service,
}: {
  locale: Locale;
  t: Dictionary;
  service: Service;
}) {
  const router = useRouter();
  const { add } = useBasket();

  const needsQuantity = service.type !== 'Package';
  const [link, setLink] = useState('');
  const [quantity, setQuantity] = useState(service.min);
  const [extras, setExtras] = useState<Record<string, string>>({ type_of_traffic: '1', device: '1' });
  const [dripFeed, setDripFeed] = useState(false);
  const [runs, setRuns] = useState('');
  const [interval, setIntervalValue] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const extraFields = EXTRA_FIELDS[service.type] ?? [];
  const setExtra = (key: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
    setExtras((prev) => ({ ...prev, [key]: e.target.value }));

  // cost = rate * quantity / 1000
  const charge = useMemo(
    () => (service.rate * (needsQuantity ? quantity : service.min)) / 1000,
    [service.rate, service.min, quantity, needsQuantity]
  );

  const validate = () => {
    if (service.type !== 'Subscriptions' && !link.trim()) {
      setError(`${t.service.link} *`);
      return false;
    }
    if (needsQuantity && (quantity < service.min || quantity > service.max)) {
      setError(`${t.service.quantity}: ${service.min} – ${service.max}`);
      return false;
    }
    for (const field of extraFields) {
      if (field === 'webtraffic') {
        if (extras.type_of_traffic === '1' && !extras.google_keyword?.trim()) {
          setError(`${t.service.googleKeyword} *`);
          return false;
        }
        if (extras.type_of_traffic === '2' && !extras.referring_url?.trim()) {
          setError(`${t.service.referringUrl} *`);
          return false;
        }
        if (!extras.country?.trim()) {
          setError(`${t.service.country} *`);
          return false;
        }
        continue;
      }
      if (!extras[field]?.trim()) {
        setError(`${field} *`);
        return false;
      }
    }
    setError(null);
    return true;
  };

  const buildExtras = () => {
    const payload: Record<string, string | number> = {};
    extraFields.forEach((field) => {
      if (field === 'webtraffic') {
        payload.country = extras.country ?? '';
        payload.device = extras.device ?? '1';
        payload.type_of_traffic = extras.type_of_traffic ?? '1';
        if (extras.google_keyword) payload.google_keyword = extras.google_keyword;
        if (extras.referring_url) payload.referring_url = extras.referring_url;
        return;
      }
      payload[field] = extras[field] ?? '';
    });
    if (dripFeed && runs && interval) {
      payload.runs = Number(runs);
      payload.interval = Number(interval);
    }
    return payload;
  };

  const onAddToBasket = () => {
    if (!validate()) return;

    add({
      serviceId: service.id,
      providerServiceId: service.provider_service_id,
      name: service.name,
      type: service.type,
      rate: service.rate,
      min: service.min,
      max: service.max,
      platform: service.platform,
      link: link.trim(),
      quantity: needsQuantity ? quantity : service.min,
      extras: buildExtras(),
    });

    setNotice(t.service.addToBasket);
    setTimeout(() => setNotice(null), 2500);
  };

  const onOrderNow = () => {
    if (!validate()) return;
    onAddToBasket();
    router.push(`/${locale}/checkout`);
  };

  return (
    <form className="tm-form tm-orderform" onSubmit={(e) => e.preventDefault()}>
      <h4>{t.services.order}</h4>

      {error && <p className="tm-alert tm-alert-error">{error}</p>}
      {notice && <p className="tm-alert tm-alert-success">{notice}</p>}

      <div className="tm-form-inner">
        {service.type !== 'Subscriptions' && (
          <div className="tm-form-field">
            <label htmlFor="order-link">{t.service.link} *</label>
            <input
              id="order-link"
              type="url"
              placeholder={t.service.linkPlaceholder}
              value={link}
              onChange={(e) => setLink(e.target.value)}
            />
          </div>
        )}

        {needsQuantity && (
          <div className="tm-form-field">
            <label htmlFor="order-quantity">
              {t.service.quantity} ({service.min.toLocaleString()} – {service.max.toLocaleString()})
            </label>
            <input
              id="order-quantity"
              type="number"
              min={service.min}
              max={service.max}
              value={quantity}
              onChange={(e) => setQuantity(Number(e.target.value) || 0)}
            />
          </div>
        )}

        {extraFields.includes('comments') && (
          <div className="tm-form-field">
            <label htmlFor="order-comments">{t.service.comments}</label>
            <textarea id="order-comments" rows={5} value={extras.comments ?? ''} onChange={setExtra('comments')} />
          </div>
        )}

        {extraFields.includes('usernames') && (
          <div className="tm-form-field">
            <label htmlFor="order-usernames">{t.service.usernames}</label>
            <textarea id="order-usernames" rows={5} value={extras.usernames ?? ''} onChange={setExtra('usernames')} />
          </div>
        )}

        {extraFields.includes('hashtags') && (
          <div className="tm-form-field">
            <label htmlFor="order-hashtags">{t.service.hashtags}</label>
            <textarea id="order-hashtags" rows={4} value={extras.hashtags ?? ''} onChange={setExtra('hashtags')} />
          </div>
        )}

        {extraFields.includes('hashtag') && (
          <div className="tm-form-field">
            <label htmlFor="order-hashtag">{t.service.hashtag}</label>
            <input id="order-hashtag" type="text" value={extras.hashtag ?? ''} onChange={setExtra('hashtag')} />
          </div>
        )}

        {extraFields.includes('username') && (
          <div className="tm-form-field">
            <label htmlFor="order-username">{t.service.username}</label>
            <input id="order-username" type="text" value={extras.username ?? ''} onChange={setExtra('username')} />
          </div>
        )}

        {extraFields.includes('media') && (
          <div className="tm-form-field">
            <label htmlFor="order-media">{t.service.media}</label>
            <input id="order-media" type="url" value={extras.media ?? ''} onChange={setExtra('media')} />
          </div>
        )}

        {extraFields.includes('answer_number') && (
          <div className="tm-form-field">
            <label htmlFor="order-answer">{t.service.answerNumber}</label>
            <input id="order-answer" type="number" min={1} value={extras.answer_number ?? ''} onChange={setExtra('answer_number')} />
          </div>
        )}

        {extraFields.includes('groups') && (
          <div className="tm-form-field">
            <label htmlFor="order-groups">{t.service.groups}</label>
            <textarea id="order-groups" rows={4} value={extras.groups ?? ''} onChange={setExtra('groups')} />
          </div>
        )}

        {extraFields.includes('webtraffic') && (
          <>
            <div className="tm-form-field tm-form-fieldhalf">
              <label htmlFor="order-country">{t.service.country}</label>
              <input id="order-country" type="text" placeholder="US" value={extras.country ?? ''} onChange={setExtra('country')} />
            </div>
            <div className="tm-form-field tm-form-fieldhalf">
              <label htmlFor="order-device">{t.service.device}</label>
              <select id="order-device" className="tm-select" value={extras.device ?? '1'} onChange={setExtra('device')}>
                {DEVICES.map((d) => (
                  <option key={d.value} value={d.value}>{d.label}</option>
                ))}
              </select>
            </div>
            <div className="tm-form-field">
              <label htmlFor="order-traffic">{t.service.trafficType}</label>
              <select id="order-traffic" className="tm-select" value={extras.type_of_traffic ?? '1'} onChange={setExtra('type_of_traffic')}>
                {TRAFFIC_TYPES.map((d) => (
                  <option key={d.value} value={d.value}>{d.label}</option>
                ))}
              </select>
            </div>
            {extras.type_of_traffic === '1' && (
              <div className="tm-form-field">
                <label htmlFor="order-keyword">{t.service.googleKeyword}</label>
                <input id="order-keyword" type="text" value={extras.google_keyword ?? ''} onChange={setExtra('google_keyword')} />
              </div>
            )}
            {extras.type_of_traffic === '2' && (
              <div className="tm-form-field">
                <label htmlFor="order-referrer">{t.service.referringUrl}</label>
                <input id="order-referrer" type="url" value={extras.referring_url ?? ''} onChange={setExtra('referring_url')} />
              </div>
            )}
          </>
        )}

        {/* Drip-feed : livraison fractionnée (runs + interval) */}
        <div className="tm-form-field">
          <input
            type="checkbox"
            id="order-dripfeed"
            checked={dripFeed}
            onChange={(e) => setDripFeed(e.target.checked)}
          />
          <label htmlFor="order-dripfeed">Drip-feed</label>
        </div>

        {dripFeed && (
          <>
            <div className="tm-form-field tm-form-fieldhalf">
              <label htmlFor="order-runs">{t.service.runs}</label>
              <input id="order-runs" type="number" min={1} value={runs} onChange={(e) => setRuns(e.target.value)} />
            </div>
            <div className="tm-form-field tm-form-fieldhalf">
              <label htmlFor="order-interval">{t.service.interval}</label>
              <input id="order-interval" type="number" min={1} value={interval} onChange={(e) => setIntervalValue(e.target.value)} />
            </div>
          </>
        )}

        <div className="tm-form-field">
          <div className="tm-ordercharge">
            <span>{t.service.charge}</span>
            <b>{money(charge)}</b>
          </div>
        </div>

        <div className="tm-form-field tm-orderform-actions">
          <button type="button" className="tm-button" data-hover="raise" onClick={onAddToBasket}>
            {t.service.addToBasket}
          </button>
          <button type="button" className="tm-button tm-button-dark" onClick={onOrderNow}>
            {t.service.orderNow}
          </button>
        </div>

        <div className="tm-form-field">
          <Link href={`/${locale}/cart`} className="tm-readmore">
            {t.nav.cart}
          </Link>
        </div>
      </div>
    </form>
  );
}
