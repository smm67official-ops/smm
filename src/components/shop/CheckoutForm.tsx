'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useRef, useState } from 'react';
import { useBasket, chargeOf } from '@/components/providers/BasketProvider';
import { useCxToast } from '@/components/motion/ToastProvider';
import ActionNeededCard from '@/components/ui/ActionNeededCard';
import { money } from '@/lib/format';
import {
  buildWhatsAppLink,
  formatWhatsApp,
  isValidWhatsApp,
  normalizeWhatsApp,
} from '@/lib/whatsapp';
import type { Locale } from '@/i18n/config';
import type { Dictionary } from '@/i18n';

/**
 * Checkout en une seule page : récapitulatif, coordonnées, paiement.
 * Une seule action principale, collée en bas sur mobile.
 */
export default function CheckoutForm({
  locale,
  t,
  defaultEmail,
  balance,
  defaultWhatsapp,
  defaultName,
  businessWhatsapp,
}: {
  locale: Locale;
  t: Dictionary;
  defaultEmail: string | null;
  balance: number;
  defaultWhatsapp?: string | null;
  defaultName?: string | null;
  /** Numéro actif (Admin -> Parameters), lu en base par la page. */
  businessWhatsapp: string;
}) {
  const router = useRouter();
  const { basket, ready, total, clear } = useBasket();
  const { toast } = useCxToast();

  /** Généré une fois par tentative : un rejeu ne crée pas deux commandes. */
  const idempotencyKey = useRef<string>(
    typeof crypto !== 'undefined' && 'randomUUID' in crypto
      ? crypto.randomUUID()
      : `k-${Date.now()}-${Math.round(Math.random() * 1e9)}`
  );

  const [first, ...rest] = (defaultName ?? '').split(' ');
  const [form, setForm] = useState({
    first_name: first ?? '',
    last_name: rest.join(' '),
    whatsapp: defaultWhatsapp ?? '',
    note: '',
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const set =
    (key: keyof typeof form) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
      setForm((f) => ({ ...f, [key]: e.target.value }));

  const signedIn = Boolean(defaultEmail);
  const whatsappOk = isValidWhatsApp(form.whatsapp);
  const insufficient = signedIn && total > balance;
  const nameOk = form.first_name.trim().length > 0;
  const canSubmit = signedIn && whatsappOk && nameOk && !insufficient && basket.length > 0;

  const topUpLink = buildWhatsAppLink(
    businessWhatsapp,
    `${t.support.topUpIntro} ${money(total - balance)}.`
  );

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!signedIn) {
      router.push(`/${locale}/login?redirect=/${locale}/checkout`);
      return;
    }

    const invalid = basket.find(
      (line) => line.type !== 'Package' && (line.quantity < line.min || line.quantity > line.max)
    );
    if (invalid) {
      setError(`${invalid.name}: ${invalid.min}–${invalid.max}`);
      return;
    }

    setLoading(true);

    // Le prix n'est jamais envoyé par le client : recalculé côté serveur.
    const response = await fetch('/api/smm/order', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...form,
        whatsapp: normalizeWhatsApp(form.whatsapp),
        idempotencyKey: idempotencyKey.current,
        note: `wallet${form.note ? ` — ${form.note}` : ''}`,
        items: basket.map((line) => ({
          serviceId: line.serviceId,
          link: line.link,
          quantity: line.quantity,
          extras: line.extras,
        })),
      }),
    });

    const result = await response.json().catch(() => ({}));
    setLoading(false);

    if (response.status === 401) {
      router.push(`/${locale}/login?redirect=/${locale}/checkout`);
      return;
    }
    if (!response.ok) {
      setError(result.error ?? t.common.error);
      toast({ tone: 'error', title: t.topup.errorTitle, description: result.error });
      return;
    }

    clear();
    router.push(`/${locale}/checkout/success?order=${result.orderId}`);
  };

  if (!ready) {
    return (
      <div className="cx-stack cx-stack--tight">
        <div className="cx-skeleton cx-skeleton--card" />
        <div className="cx-skeleton cx-skeleton--card" />
      </div>
    );
  }

  if (basket.length === 0) {
    return (
      <div className="cx-card">
        <div className="cx-empty">
          <span className="cx-empty__icon">
            <i className="ion-bag" />
          </span>
          <h3>{t.checkout.emptyBasket}</h3>
          <Link href={`/${locale}/services`} className="cx-btn cx-btn--primary cx-btn--auto">
            {t.cart.browse}
          </Link>
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} className="cx-stack">
      {error && (
        <div className="cx-alert cx-alert--error">
          <i className="ion-alert-circled" />
          {error}
        </div>
      )}

      {/* Connexion requise — action, pas blocage muet */}
      {!signedIn && (
        <ActionNeededCard
          title={t.checkout.signInRequired}
          description={t.checkout.signInRequiredHint}
          primaryLabel={t.checkout.signInToPay}
          primaryHref={`/${locale}/login?redirect=/${locale}/checkout`}
        />
      )}

      {/* Solde insuffisant — on propose de recharger, pas juste une erreur */}
      {insufficient && (
        <ActionNeededCard
          title={t.checkout.insufficientTitle}
          description={t.checkout.insufficientHint
            .replace('{missing}', money(total - balance))
            .replace('{balance}', money(balance))}
          whatsappLabel={t.checkout.topUpWhatsapp}
          whatsappHref={topUpLink}
        />
      )}

      {/* 1. Ce que le client achète */}
      <section className="cx-card">
        <h2 style={{ margin: '0 0 10px', fontSize: 15, fontFamily: 'Montserrat, sans-serif' }}>
          {t.checkout.summary}
        </h2>
        {basket.map((line) => (
          <div className="cx-kv" key={line.id}>
            <span style={{ maxWidth: '62%' }}>
              {line.name}
              <br />
              <span style={{ fontSize: 11.5, color: '#9ca3af' }}>
                × {line.quantity.toLocaleString()}
              </span>
            </span>
            <b>{money(chargeOf(line))}</b>
          </div>
        ))}
        <div className="cx-kv cx-kv--total">
          <span>{t.cart.total}</span>
          <b>{money(total)}</b>
        </div>
      </section>

      {/* 2. Coordonnées — champs strictement nécessaires */}
      <section className="cx-card cx-stack">
        <h2 style={{ margin: 0, fontSize: 15, fontFamily: 'Montserrat, sans-serif' }}>
          {t.checkout.contact}
        </h2>

        <div className="cx-grid-2">
          <div className="cx-field">
            <label htmlFor="co-first">{t.checkout.firstName} *</label>
            <input id="co-first" type="text" required value={form.first_name} onChange={set('first_name')} />
          </div>
          <div className="cx-field">
            <label htmlFor="co-last">{t.checkout.lastName}</label>
            <input id="co-last" type="text" value={form.last_name} onChange={set('last_name')} />
          </div>
        </div>

        <div className="cx-field">
          <label htmlFor="co-wa">{t.checkout.whatsapp} *</label>
          <input
            id="co-wa"
            type="tel"
            inputMode="tel"
            required
            placeholder="+212 6 12 34 56 78"
            value={form.whatsapp}
            onChange={set('whatsapp')}
          />
          {form.whatsapp.length > 0 ? (
            <span className={whatsappOk ? 'cx-field__ok' : 'cx-field__err'}>
              {whatsappOk
                ? `${t.checkout.whatsappSaved}: ${formatWhatsApp(normalizeWhatsApp(form.whatsapp))}`
                : t.checkout.whatsappInvalid}
            </span>
          ) : (
            <span className="cx-field__hint">{t.checkout.whatsappHint}</span>
          )}
        </div>

        <div className="cx-field">
          <label htmlFor="co-note">{t.checkout.note}</label>
          <textarea id="co-note" rows={2} value={form.note} onChange={set('note')} />
        </div>
      </section>

      {/* 3. Paiement */}
      <section className="cx-card">
        <h2 style={{ margin: '0 0 10px', fontSize: 15, fontFamily: 'Montserrat, sans-serif' }}>
          {t.checkout.payment}
        </h2>
        <div className="cx-kv">
          <span>
            <i className="ion-card" style={{ marginInlineEnd: 7, color: '#9a6b0f' }} />
            {t.checkout.walletBalance}
          </span>
          <b>{signedIn ? money(balance) : '—'}</b>
        </div>
        <div className="cx-kv">
          <span>{t.checkout.orderTotal}</span>
          <b>− {money(total)}</b>
        </div>
        {signedIn && (
          <div className="cx-kv cx-kv--total">
            <span>{insufficient ? t.checkout.missing : t.checkout.remaining}</span>
            <b style={insufficient ? { color: '#b91c1c' } : undefined}>
              {money(Math.abs(balance - total))}
            </b>
          </div>
        )}
      </section>

      {/* Action principale collante */}
      <div className="cx-sticky">
        <div className="cx-sticky__row">
          <span>{t.cart.total}</span>
          <span className="cx-sticky__total">{money(total)}</span>
        </div>
        <button
          type="submit"
          className="cx-btn cx-btn--primary"
          data-hover="raise"
          disabled={loading || !canSubmit}
        >
          {loading && <span className="mx-spinner" aria-hidden="true" />}
          {loading ? t.checkout.submitting : t.checkout.confirmOrder}
          {!loading && <i className="ion-arrow-right-c" />}
        </button>
      </div>
    </form>
  );
}
