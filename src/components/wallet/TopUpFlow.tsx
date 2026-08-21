'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import CxDialog from '@/components/motion/CxDialog';
import { useCxToast } from '@/components/motion/ToastProvider';
import { successPop } from '@/lib/motion/presets';
import { money } from '@/lib/format';
import { BUSINESS_WHATSAPP, buildWhatsAppLink } from '@/lib/whatsapp';
import type { Locale } from '@/i18n/config';
import type { Dictionary } from '@/i18n';

/** Doivent rester alignés sur `TOPUP_*` côté serveur (src/lib/topup.ts). */
const PRESETS = [10, 25, 50, 100];
const MIN = 1;
const MAX = 5000;
const BONUS_THRESHOLD = 100;
const BONUS_RATE = 0.05;

/** Miroir d'affichage : le serveur reste seul à décider du bonus réel. */
const bonusFor = (amount: number) =>
  Number.isFinite(amount) && amount >= BONUS_THRESHOLD
    ? Math.round(amount * BONUS_RATE * 100) / 100
    : 0;

type Step = 'amount' | 'handoff' | 'done';

/**
 * Parcours de recharge.
 *
 *   montant → (demande enregistrée) → WhatsApp si nécessaire → succès
 *
 * WhatsApp n'apparaît que parce que la confirmation de paiement est
 * manuelle : sans numéro professionnel configuré, l'étape disparaît et
 * le client reste dans la plateforme.
 */
export default function TopUpFlow({
  locale,
  t,
  open,
  onClose,
  defaultWhatsapp,
}: {
  locale: Locale;
  t: Dictionary;
  open: boolean;
  onClose: () => void;
  defaultWhatsapp?: string | null;
}) {
  const router = useRouter();
  const { toast } = useCxToast();

  const [step, setStep] = useState<Step>('amount');
  const [preset, setPreset] = useState<number | null>(PRESETS[1]);
  const [custom, setCustom] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [reference, setReference] = useState<string | null>(null);
  /** Court état « ouverture de WhatsApp » avant de passer au succès. */
  const [handing, setHanding] = useState(false);

  const checkRef = useRef<HTMLSpanElement>(null);

  const amount = preset ?? Number(custom.replace(',', '.'));
  const amountValid = Number.isFinite(amount) && amount >= MIN && amount <= MAX;
  const bonus = amountValid ? bonusFor(amount) : 0;
  const percent = `${Math.round(BONUS_RATE * 100)}%`;

  // Chaque ouverture repart de zéro : réafficher l'écran de succès d'une
  // demande précédente laisserait croire qu'une nouvelle a été envoyée.
  useEffect(() => {
    if (!open) return;
    setStep('amount');
    setPreset(PRESETS[1]);
    setCustom('');
    setError(null);
    setReference(null);
    setHanding(false);
  }, [open]);

  useEffect(() => {
    if (step === 'done' && checkRef.current) successPop(checkRef.current);
  }, [step]);

  const whatsappLink =
    BUSINESS_WHATSAPP && reference
      ? buildWhatsAppLink(
          BUSINESS_WHATSAPP,
          t.topup.message
            .replace('{amount}', money(amount))
            .replace('{ref}', reference.slice(0, 8).toUpperCase())
        )
      : null;

  const submit = async () => {
    if (!amountValid) {
      setError(
        !custom && preset === null
          ? t.topup.required
          : amount < MIN
            ? t.topup.tooLow.replace('{min}', money(MIN))
            : t.topup.tooHigh.replace('{max}', money(MAX))
      );
      return;
    }

    setError(null);
    setLoading(true);

    const response = await fetch('/api/wallet/topup', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ amount, whatsapp: defaultWhatsapp ?? undefined }),
    });

    const result = await response.json().catch(() => ({}));
    setLoading(false);

    if (!response.ok) {
      setError(result.error ?? t.common.error);
      toast({ tone: 'error', title: t.topup.errorTitle, description: result.error });
      return;
    }

    setReference(result.request.id as string);
    toast({
      tone: 'wallet',
      title: t.topup.toastTitle,
      description: t.topup.toastBody.replace('{amount}', money(amount)),
    });

    // Le solde n'a pas bougé, mais la liste des demandes en attente si.
    router.refresh();

    // Sans numéro professionnel, l'étape WhatsApp n'apporte rien.
    setStep(BUSINESS_WHATSAPP ? 'handoff' : 'done');
  };

  const pickPreset = (value: number) => {
    setPreset(value);
    setCustom('');
    setError(null);
  };

  const pickCustom = (value: string) => {
    setCustom(value.replace(/[^\d.,]/g, ''));
    setPreset(null);
    setError(null);
  };

  return (
    <CxDialog
      open={open}
      onClose={onClose}
      title={step === 'handoff' ? t.topup.whatsappTitle.replace('{amount}', money(amount)) : t.topup.title}
      description={step === 'amount' ? t.topup.question : undefined}
      footer={
        step === 'amount' ? (
          <button
            type="button"
            className="cx-btn cx-btn--primary"
            data-press
            data-hover="raise"
            disabled={loading}
            onClick={() => void submit()}
          >
            {loading ? <span className="mx-spinner" aria-hidden="true" /> : null}
            {t.topup.continueLabel}
            {!loading && <i className="ion-arrow-right-c" />}
          </button>
        ) : null
      }
    >
      {step === 'amount' && (
        <>
          <div className="cx-amounts">
            {PRESETS.map((value) => (
              <button
                key={value}
                type="button"
                className={`cx-amount${preset === value ? ' is-active' : ''}`}
                data-press
                aria-pressed={preset === value}
                onClick={() => pickPreset(value)}
              >
                {money(value)}
              </button>
            ))}
          </div>

          <div className="cx-or" role="separator">
            <span>{t.topup.custom}</span>
          </div>

          {/* Le bonus est annoncé avant de valider, pas découvert après. */}
          {bonus > 0 ? (
            <p className="cx-bonus is-earned">
              <i className="ion-ribbon-a" />
              {t.topup.bonusEarned.replace('{percent}', percent)}
              <b>+{money(bonus)}</b>
            </p>
          ) : (
            <p className="cx-bonus">
              <i className="ion-ribbon-a" />
              {t.topup.bonusHint
                .replace('{amount}', money(BONUS_THRESHOLD))
                .replace('{percent}', percent)}
            </p>
          )}

          <div className="cx-field">
            <label htmlFor="topup-custom">{t.topup.customLabel}</label>
            <input
              id="topup-custom"
              type="text"
              inputMode="decimal"
              autoComplete="off"
              placeholder={String(MIN)}
              value={custom}
              onChange={(event) => pickCustom(event.target.value)}
            />
            {error ? (
              <span className="cx-field__err" role="alert">
                {error}
              </span>
            ) : (
              <span className="cx-field__hint">
                {t.topup.customHint.replace('{min}', money(MIN)).replace('{max}', money(MAX))}
              </span>
            )}
          </div>
        </>
      )}

      {step === 'handoff' && (
        <div className="cx-stack">
          <p className="cx-dialog__lead">{t.topup.whatsappLead}</p>

          <div className="cx-kv">
            <span>{t.topup.customLabel}</span>
            <b>{money(amount)}</b>
          </div>
          {bonus > 0 && (
            <>
              <div className="cx-kv">
                <span>{t.topup.bonus}</span>
                <b style={{ color: '#15803d' }}>+{money(bonus)}</b>
              </div>
              <div className="cx-kv cx-kv--total">
                <span>{t.topup.credited}</span>
                <b>{money(amount + bonus)}</b>
              </div>
            </>
          )}
          <div className="cx-kv">
            <span>{t.topup.reference}</span>
            <b>#{reference?.slice(0, 8).toUpperCase()}</b>
          </div>

          {/*
            Vrai lien, pas un `window.open` différé : l'onglet s'ouvre sur
            le clic natif, donc jamais bloqué par le navigateur. La bascule
            vers l'écran de succès est simplement retardée le temps d'une
            courte transition — assez pour que le passage soit lisible,
            assez court pour ne pas retenir l'utilisateur.
          */}
          {whatsappLink && (
            <a
              href={whatsappLink}
              target="_blank"
              rel="noreferrer noopener"
              className="cx-btn cx-btn--whatsapp"
              aria-busy={handing}
              data-press
              data-hover="raise"
              onClick={() => {
                setHanding(true);
                window.setTimeout(() => setStep('done'), 420);
              }}
            >
              {handing ? (
                <span className="mx-spinner" aria-hidden="true" />
              ) : (
                <i className="ion-social-whatsapp" />
              )}
              {t.topup.whatsappCta}
            </a>
          )}

          <p className="cx-field__hint" style={{ textAlign: 'center' }}>
            {t.topup.whatsappHint}
          </p>

          <button type="button" className="cx-btn cx-btn--ghost" data-press onClick={() => setStep('done')}>
            {t.topup.later}
          </button>
        </div>
      )}

      {step === 'done' && (
        <div className="cx-success" style={{ paddingTop: 0 }}>
          <span ref={checkRef} className="cx-success__check">
            <i className="ion-checkmark" />
          </span>
          <h3 style={{ margin: 0, fontFamily: 'Montserrat, sans-serif', fontSize: 19 }}>
            {t.topup.doneTitle}
          </h3>
          <p>{BUSINESS_WHATSAPP ? t.topup.doneLead : t.topup.manualLead}</p>

          <div className="cx-stack" style={{ marginTop: 18 }}>
            <Link
              href={`/${locale}/account/wallet`}
              className="cx-btn cx-btn--primary"
              data-press
              data-hover="raise"
              onClick={onClose}
            >
              {t.topup.seeHistory}
            </Link>
            <Link
              href={`/${locale}/services`}
              className="cx-btn cx-btn--ghost"
              data-press
              onClick={onClose}
            >
              {t.topup.backToShop}
            </Link>
          </div>
        </div>
      )}
    </CxDialog>
  );
}
