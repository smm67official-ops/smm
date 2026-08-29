'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { Button, Icon, Input, Modal, Select, Textarea, useToast } from '@/design-system';
import { MARGIN_MAX, MARGIN_MIN, sellingPrice, validateMargin } from '@/lib/pricing';
import { formatWhatsApp } from '@/lib/whatsapp';
import type { AppSettings } from '@/lib/supabase/types';

/**
 * Réglages généraux : widget WhatsApp et marge de vente.
 *
 * Le NUMÉRO n'est pas ici — il vit dans la carte « WhatsApp numbers »
 * juste au-dessus, avec sa règle « un seul actif ». Le proposer aux deux
 * endroits créerait deux sources à tenir d'accord.
 */
export default function GeneralSettings({
  settings,
  activeNumber,
  customMarginCount,
  serviceCount,
}: {
  settings: AppSettings;
  activeNumber: string | null;
  customMarginCount: number;
  serviceCount: number;
}) {
  const router = useRouter();
  const { toast } = useToast();

  const [form, setForm] = useState({
    whatsapp_enabled: settings.whatsapp_enabled,
    whatsapp_message: settings.whatsapp_message ?? '',
    whatsapp_greeting: settings.whatsapp_greeting ?? '',
    whatsapp_position: settings.whatsapp_position,
  });

  const [margin, setMargin] = useState(String(settings.global_service_margin));
  const [busy, setBusy] = useState(false);
  const [applying, setApplying] = useState(false);
  const [confirmApply, setConfirmApply] = useState(false);
  const [resetCustoms, setResetCustoms] = useState(true);

  /** Envoi automatique : état courant, confirmation, solde fournisseur. */
  const [autoSubmit, setAutoSubmit] = useState(settings.auto_submit_orders);
  const [confirmSubmit, setConfirmSubmit] = useState(false);
  const [provider, setProvider] = useState<{ balance: number | null; status: string } | null>(null);

  /**
   * Ouvre la confirmation, et va chercher le solde fournisseur.
   *
   * C'est le chiffre qui décide : activer l'envoi avec un compte à zéro
   * ne produit que des commandes refusées. Autant le montrer avant, pas
   * après.
   */
  const askAutoSubmit = async () => {
    setProvider(null);
    setConfirmSubmit(true);

    const response = await fetch('/api/admin/balance');
    const result = await response.json().catch(() => null);
    if (response.ok && result) {
      setProvider({ balance: result.provider?.balance ?? null, status: result.provider?.status ?? 'ERROR' });
    }
  };

  const saveAutoSubmit = async () => {
    const next = !autoSubmit;
    setBusy(true);

    const response = await fetch('/api/admin/settings', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ auto_submit_orders: next }),
    });
    const result = await response.json().catch(() => ({}));
    setBusy(false);
    setConfirmSubmit(false);

    if (!response.ok) {
      toast({ tone: 'error', title: 'Could not change', description: result.error });
      return;
    }

    setAutoSubmit(next);
    toast({
      tone: next ? 'success' : 'info',
      title: next ? 'Orders are now sent to SMMGen' : 'Order submission paused',
      description: next
        ? 'New orders go to the provider immediately.'
        : 'Orders are still recorded and charged, but not delivered.',
    });
    router.refresh();
  };

  const saveWidget = async () => {
    setBusy(true);

    const response = await fetch('/api/admin/settings', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    });
    const result = await response.json().catch(() => ({}));
    setBusy(false);

    if (!response.ok) {
      toast({ tone: 'error', title: 'Could not save', description: result.error });
      return;
    }

    toast({ tone: 'success', title: 'WhatsApp widget updated' });
    router.refresh();
  };

  /** Change la marge globale SANS toucher aux exceptions ni aux prix. */
  const saveMargin = async () => {
    const check = validateMargin(margin);
    if (!check.ok) {
      toast({ tone: 'error', title: 'Invalid margin' });
      return;
    }

    setBusy(true);
    const response = await fetch('/api/admin/settings', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ global_service_margin: check.margin }),
    });
    const result = await response.json().catch(() => ({}));
    setBusy(false);

    if (!response.ok) {
      toast({ tone: 'error', title: 'Could not save', description: result.error });
      return;
    }

    toast({
      tone: 'success',
      title: `Global margin set to ${check.margin}%`,
      description: 'Prices update at the next catalogue sync, or apply it now.',
    });
    router.refresh();
  };

  /** Applique la marge à tout le catalogue, prix recalculés maintenant. */
  const applyToAll = async () => {
    const check = validateMargin(margin);
    if (!check.ok) return;

    setApplying(true);

    const response = await fetch('/api/admin/services/apply-global-margin', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ margin: check.margin, reset_custom_margins: resetCustoms }),
    });
    const result = await response.json().catch(() => ({}));
    setApplying(false);
    setConfirmApply(false);

    if (!response.ok) {
      toast({ tone: 'error', title: 'Could not apply', description: result.error });
      return;
    }

    toast({
      tone: 'success',
      title: `${check.margin}% applied to ${result.updatedServices} service(s)`,
      description:
        result.resetCustomMargins > 0
          ? `${result.resetCustomMargins} custom margin(s) reset.`
          : undefined,
    });
    router.refresh();
  };

  const marginValue = Number(margin);
  const preview = Number.isFinite(marginValue) ? sellingPrice(10, marginValue) : null;

  return (
    <>
      {/* ---------------- Widget WhatsApp ---------------- */}
      <section className="gp-card">
        <header className="gp-card-head">
          <div>
            <p className="gp-card-head__eyebrow">Contact</p>
            <h3 className="gp-card-head__title">WhatsApp widget</h3>
            <p className="gp-card-head__desc">
              A floating button on every public page. It uses the active number above — never a
              number typed here, so there is only ever one to keep up to date.
            </p>
          </div>
          <div className="gp-hero__actions">
            <Button size="sm" loading={busy} onClick={saveWidget}>
              Save
            </Button>
          </div>
        </header>

        <div className="gp-form-grid">
          {/* Interrupteur en tête : c'est lui qui décide si le reste
              sert à quelque chose. */}
          <label className="gp-form-toggle gp-form-grid__full">
            <input
              type="checkbox"
              checked={form.whatsapp_enabled}
              onChange={(e) => setForm({ ...form, whatsapp_enabled: e.target.checked })}
            />
            <span className="gp-form-toggle__text">
              <span className="gp-form-toggle__title">Enable WhatsApp widget</span>
              <span className="gp-form-toggle__hint">
                {activeNumber
                  ? 'The floating button appears on every public page.'
                  : 'Add and activate a number above for the button to appear.'}
              </span>
            </span>
          </label>

          <Input
            label="Active number"
            value={activeNumber ? formatWhatsApp(activeNumber) : 'No active number'}
            readOnly
            hint="Set in WhatsApp numbers above."
          />

          <Select
            label="Position"
            value={form.whatsapp_position}
            onChange={(e) =>
              setForm({ ...form, whatsapp_position: e.target.value as 'bottom-right' | 'bottom-left' })
            }
            options={[
              { value: 'bottom-right', label: 'Bottom right' },
              { value: 'bottom-left', label: 'Bottom left' },
            ]}
          />

          <div className="gp-form-grid__full">
            <Textarea
              label="Default message"
              optional
              rows={3}
              value={form.whatsapp_message}
              onChange={(e) => setForm({ ...form, whatsapp_message: e.target.value })}
              placeholder="Bonjour, j'aimerais avoir plus d'informations."
              hint="Pre-filled in WhatsApp. Left empty, a translated default is used."
            />
          </div>

          <div className="gp-form-grid__full">
            <Textarea
              label="Greeting bubble"
              optional
              rows={3}
              value={form.whatsapp_greeting}
              onChange={(e) => setForm({ ...form, whatsapp_greeting: e.target.value })}
              placeholder="Une question ? Nous répondons en quelques minutes."
              hint="Shown before opening WhatsApp. Empty = the button opens WhatsApp directly."
            />
          </div>
        </div>
      </section>

      {/* ---------------- Envoi des commandes ---------------- */}
      <section className="gp-card">
        <header className="gp-card-head">
          <div>
            <p className="gp-card-head__eyebrow">Orders</p>
            <h3 className="gp-card-head__title">Send orders to SMMGen</h3>
            <p className="gp-card-head__desc">
              When off, orders are recorded and the client is charged, but nothing reaches the
              provider — so nothing is delivered.
            </p>
          </div>
          <div className="gp-hero__actions">
            <span className={`gp-pill ${autoSubmit ? 'gp-pill--success' : 'gp-pill--warning'}`}>
              <span className="gp-pill__dot" />
              {autoSubmit ? 'Sending' : 'Paused'}
            </span>
          </div>
        </header>

        <div className="gp-form-grid">
          <label className="gp-form-toggle gp-form-grid__full" onClick={(e) => e.preventDefault()}>
            <input type="checkbox" checked={autoSubmit} readOnly />
            <span className="gp-form-toggle__text">
              <span className="gp-form-toggle__title">Automatic submission</span>
              <span className="gp-form-toggle__hint">
                {autoSubmit
                  ? 'Every new order is sent to SMMGen straight away and spends your provider balance.'
                  : 'Orders wait in the panel. Customers are charged but receive nothing until you turn this on.'}
              </span>
            </span>
          </label>

          <div className="gp-form-grid__full">
            <Button size="sm" variant={autoSubmit ? 'ghost' : 'primary'} onClick={askAutoSubmit}>
              {autoSubmit ? 'Pause submission' : 'Start sending orders'}
            </Button>
          </div>
        </div>
      </section>

      {/* ---------------- Marge ---------------- */}
      <section className="gp-card">
        <header className="gp-card-head">
          <div>
            <p className="gp-card-head__eyebrow">Pricing</p>
            <h3 className="gp-card-head__title">Global service margin</h3>
            <p className="gp-card-head__desc">
              Selling price = provider cost × (1 + margin). A service with its own margin keeps it
              unless you reset custom margins below.
            </p>
          </div>
        </header>

        <div className="gp-form-grid">
          <Input
            label="Margin (%)"
            type="number"
            min={MARGIN_MIN}
            max={MARGIN_MAX}
            step="0.01"
            value={margin}
            onChange={(e) => setMargin(e.target.value)}
            hint={
              preview !== null
                ? `A $10.00 provider cost sells for $${preview.toFixed(2)}.`
                : `Between ${MARGIN_MIN} and ${MARGIN_MAX}%.`
            }
          />

          <div className="gp-kv-list">
            <p>
              Services: <strong>{serviceCount.toLocaleString('en-US')}</strong>
            </p>
            <p>
              With a custom margin: <strong>{customMarginCount.toLocaleString('en-US')}</strong>
            </p>
          </div>
        </div>

        <div className="gp-table__actions" style={{ padding: '0 var(--sv-space-5) var(--sv-space-5)' }}>
          <Button size="sm" variant="ghost" loading={busy} onClick={saveMargin}>
            Save margin only
          </Button>
          <Button size="sm" onClick={() => setConfirmApply(true)}>
            <Icon name="refresh" size={14} /> Apply to all services
          </Button>
        </div>
      </section>

      {/*
        Confirmation de l'envoi automatique.

        Le réglage engage de l'argent réel : la boîte annonce ce qui
        change, et rappelle le solde fournisseur — activer l'envoi avec un
        compte à zéro ne produirait que des commandes refusées.
      */}
      <Modal
        open={confirmSubmit}
        onClose={() => setConfirmSubmit(false)}
        title={autoSubmit ? 'Pause order submission?' : 'Start sending orders to SMMGen?'}
        footer={
          <>
            <Button variant="ghost" onClick={() => setConfirmSubmit(false)}>
              Cancel
            </Button>
            <Button loading={busy} onClick={saveAutoSubmit}>
              {autoSubmit ? 'Pause' : 'Start sending'}
            </Button>
          </>
        }
      >
        <div className="sv-stack" style={{ gap: 'var(--sv-space-3)' }}>
          {autoSubmit ? (
            <p className="gp-card-head__desc" style={{ margin: 0 }}>
              New orders will be recorded and charged to the customer, but not sent to the provider —
              so nothing will be delivered until you turn this back on. Orders already sent are
              unaffected.
            </p>
          ) : (
            <>
              <p className="gp-card-head__desc" style={{ margin: 0 }}>
                Every new order will be forwarded to SMMGen immediately and will spend your provider
                balance. There is no review step in between.
              </p>

              <div className="gp-card__inner">
                <p className="gp-card-head__eyebrow">SMMGen balance</p>
                <p className="gp-stat-card__value">
                  {provider === null
                    ? 'checking…'
                    : provider.balance === null
                      ? 'unavailable'
                      : `$${provider.balance.toFixed(2)}`}
                </p>
              </div>

              {provider !== null && (provider.balance ?? 0) <= 0 && (
                <p className="tm-alert tm-alert-error" role="alert" style={{ margin: 0 }}>
                  Your provider balance is empty. Orders will be rejected by SMMGen — the customer is
                  refunded automatically, but nothing is delivered. Fund the account first.
                </p>
              )}
            </>
          )}
        </div>
      </Modal>

      {/* Confirmation : l'action touche tout le catalogue d'un coup. */}
      <Modal
        open={confirmApply}
        onClose={() => setConfirmApply(false)}
        title={`Apply ${margin}% to all services?`}
        footer={
          <>
            <Button variant="ghost" onClick={() => setConfirmApply(false)}>
              Cancel
            </Button>
            <Button loading={applying} onClick={applyToAll}>
              Confirm
            </Button>
          </>
        }
      >
        <div className="sv-stack" style={{ gap: 'var(--sv-space-3)' }}>
          <p className="gp-card-head__desc" style={{ margin: 0 }}>
            This recalculates the selling price of{' '}
            <strong>{serviceCount.toLocaleString('en-US')}</strong> service(s) in a single
            transaction — it either all applies, or none of it does.
          </p>

          <label style={{ display: 'flex', alignItems: 'flex-start', gap: 'var(--sv-space-2)' }}>
            <input
              type="checkbox"
              checked={resetCustoms}
              onChange={(e) => setResetCustoms(e.target.checked)}
              style={{ marginTop: 4 }}
            />
            <span>
              Reset custom margins
              <span className="gp-table__muted" style={{ display: 'block' }}>
                {customMarginCount > 0
                  ? `${customMarginCount} service(s) will lose their own margin and follow the global one.`
                  : 'No service currently has a custom margin.'}
              </span>
            </span>
          </label>

          {!resetCustoms && customMarginCount > 0 && (
            <p className="gp-card-head__desc" style={{ margin: 0 }}>
              Custom margins are kept: those {customMarginCount} service(s) keep their own price.
            </p>
          )}
        </div>
      </Modal>
    </>
  );
}
