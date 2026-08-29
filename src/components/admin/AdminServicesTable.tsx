'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { Button, Icon, Input, Modal, Select, useToast } from '@/design-system';
import { MARGIN_MAX, MARGIN_MIN, effectiveMargin, sellingPrice } from '@/lib/pricing';
import { platformOf } from '@/lib/platforms';
import type { Service } from '@/lib/supabase/types';

const rate = (value: number) =>
  `$${Number(value ?? 0).toFixed(5).replace(/0+$/, '').replace(/\.$/, '')}`;

export default function AdminServicesTable({
  globalMargin,
  locale,
  services,
}: {
  globalMargin: number;
  locale: string;
  services: Service[];
}) {
  const router = useRouter();
  const { toast } = useToast();

  const [editing, setEditing] = useState<Service | null>(null);
  const [form, setForm] = useState({
    name: '',
    rate: 0,
    min: 0,
    max: 0,
    margin_mode: 'global' as 'global' | 'custom',
    custom_margin: '',
  });
  const [busy, setBusy] = useState(false);
  const [togglingId, setTogglingId] = useState<string | null>(null);

  const openEdit = (service: Service) => {
    setForm({
      name: service.name,
      rate: Number(service.rate),
      min: service.min,
      max: service.max,
      margin_mode: service.margin_mode ?? 'global',
      custom_margin:
        service.custom_margin === null || service.custom_margin === undefined
          ? ''
          : String(service.custom_margin),
    });
    setEditing(service);
  };

  const patch = async (id: string, body: Record<string, unknown>) => {
    const response = await fetch(`/api/admin/services/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    const result = await response.json().catch(() => ({}));
    return { ok: response.ok, result };
  };

  const save = async () => {
    if (!editing) return;
    setBusy(true);

    if (!form.name.trim()) {
      toast({ tone: 'error', title: 'Name cannot be empty' });
      setBusy(false);
      return;
    }

    const { ok, result } = await patch(editing.id, {
      name: form.name,
      margin_mode: form.margin_mode,
      custom_margin: form.margin_mode === 'custom' ? Number(form.custom_margin) : null,
      min: Number(form.min),
      max: Number(form.max),
    });
    setBusy(false);

    if (!ok) {
      toast({ tone: 'error', title: 'Update failed', description: result.error });
      return;
    }

    toast({ tone: 'success', title: 'Service updated' });
    setEditing(null);
    router.refresh();
  };

  /** Restaure le libellé du fournisseur, immédiatement. */
  const unlockName = async () => {
    if (!editing) return;
    setBusy(true);

    const { ok, result } = await patch(editing.id, { unlockName: true });
    setBusy(false);

    if (!ok) {
      toast({ tone: 'error', title: 'Update failed', description: result.error });
      return;
    }

    toast({ tone: 'success', title: 'Provider name restored' });
    setEditing(null);
    router.refresh();
  };


  const toggleActive = async (service: Service) => {
    setTogglingId(service.id);
    const { ok, result } = await patch(service.id, { is_active: !service.is_active });
    setTogglingId(null);

    if (!ok) {
      toast({ tone: 'error', title: 'Update failed', description: result.error });
      return;
    }

    toast({
      tone: 'success',
      title: service.is_active ? 'Service disabled' : 'Service enabled',
      description: service.name.slice(0, 60),
    });
    router.refresh();
  };


  return (
    <>
      <div className="gp-table-wrap">
        <table className="gp-table rs-table">
          <thead>
            <tr>
              {/* Identifiant chez le fournisseur : c'est par lui qu'on
                  retrouve un service dans le panel SMMGen ou qu'on le
                  cite à leur support. */}
              <th className="gp-table__num">SMMGen ID</th>
              <th>Service</th>
              <th>Type</th>
              <th className="gp-table__num">Cost / 1000</th>
              <th className="gp-table__num">Margin</th>
              <th>Margin type</th>
              <th className="gp-table__num">Sell / 1000</th>
              <th className="gp-table__num">Min</th>
              <th className="gp-table__num">Max</th>
              <th>Flags</th>
              <th className="gp-table__num">Actions</th>
            </tr>
          </thead>
          <tbody>
            {services.map((service) => {
              const platform = platformOf(service.platform);
              return (
                <tr key={service.id} style={service.is_active ? undefined : { opacity: 0.55 }}>
                  <td className="gp-table__num" data-label="SMMGen ID">
                    <span className="gp-table__strong" style={{ fontVariantNumeric: 'tabular-nums' }}>
                      {service.provider_service_id}
                    </span>
                  </td>
                  <td data-label="Service" className="rs-cell--head">
                    <Link href={`/${locale}/services/${service.id}`} className="gp-table__strong">
                      {service.name.length > 70 ? `${service.name.slice(0, 70)}…` : service.name}
                    </Link>
                    <div className="gp-table__muted">
                      {platform ? `${platform.label} · ` : ''}
                      {service.category_name ?? '—'}
                    </div>
                  </td>
                  <td className="gp-table__muted" data-label="Type">{service.type}</td>
                  <td className="gp-table__num" data-label="Cost / 1000">{rate(service.provider_rate)}</td>

                  {/* Marge appliquée, et d'où elle vient : sans le type,
                      un 20 % global et un 20 % individuel sont
                      indiscernables, et « appliquer à tous » réserverait
                      une surprise. */}
                  <td className="gp-table__num" data-label="Margin">
                    {effectiveMargin(service, globalMargin).toFixed(2)}%
                  </td>
                  <td data-label="Margin type">
                    <span
                      className={`gp-pill ${service.margin_mode === 'custom' ? 'gp-pill--brand' : 'gp-pill--neutral'}`}
                    >
                      <span className="gp-pill__dot" />
                      {service.margin_mode === 'custom' ? 'Custom' : 'Global'}
                    </span>
                  </td>
                  <td className="gp-table__num gp-table__strong" data-label="Sell / 1000">
                    {rate(service.rate)}
                    {service.rate_locked && (
                      <span
                        title="Manual price — protected from catalogue sync"
                        style={{ marginInlineStart: 5, color: 'var(--gp-brand-ink)' }}
                      >
                        <Icon name="lock" size={11} />
                      </span>
                    )}
                  </td>
                  <td className="gp-table__num" data-label="Min">{service.min.toLocaleString()}</td>
                  <td className="gp-table__num" data-label="Max">{service.max.toLocaleString()}</td>
                  <td data-label="Flags">
                    <span className="gp-table__actions" style={{ justifyContent: 'flex-start' }}>
                      {service.is_active ? (
                        <span className="gp-pill gp-pill--success">Active</span>
                      ) : (
                        <span className="gp-pill gp-pill--neutral">Off</span>
                      )}
                      {service.refill && <span className="gp-pill gp-pill--info">Refill</span>}
                      {service.cancel && <span className="gp-pill">Cancel</span>}
                    </span>
                  </td>
                  <td data-label="">
                    <div className="gp-table__actions">
                      <button
                        type="button"
                        className="gp-btn gp-btn--sm"
                        onClick={() => openEdit(service)}
                      >
                        <Icon name="refresh" size={13} />
                        Edit
                      </button>
                      <button
                        type="button"
                        className={`gp-btn gp-btn--sm${service.is_active ? '' : ' gp-btn--primary'}`}
                        disabled={togglingId === service.id}
                        onClick={() => void toggleActive(service)}
                      >
                        {service.is_active ? 'Disable' : 'Enable'}
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <Modal
        open={Boolean(editing)}
        onClose={() => setEditing(null)}
        title="Edit service"
        description={editing?.provider_name ?? editing?.name}
        footer={
          <>
            <Button variant="secondary" onClick={() => setEditing(null)}>
              Cancel
            </Button>
            <Button loading={busy} onClick={save}>
              Save changes
            </Button>
          </>
        }
      >
        <div className="sv-stack" style={{ gap: 'var(--sv-space-4)' }}>
          <Input
            label="Display name"
            value={form.name}
            onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
            hint={
              editing?.name_locked
                ? 'Renamed: this label survives every catalogue sync.'
                : 'Provider label. Saving keeps your wording through future syncs.'
            }
          />

          {editing?.name_locked && editing.provider_name && (
            <>
              <Input
                label="Provider label"
                value={editing.provider_name}
                readOnly
                hint="Kept for reference when contacting the provider."
              />
              <button type="button" className="gp-btn gp-btn--sm" onClick={unlockName} disabled={busy}>
                <Icon name="refresh" size={13} />
                Back to provider name
              </button>
            </>
          )}

          <Input
            label="Provider cost / 1000"
            value={editing ? rate(editing.provider_rate) : ''}
            readOnly
            hint="Overwritten at each catalogue sync."
          />
          {/*
            Le prix se règle par la MARGE, pas en valeur absolue : une
            marge résiste à un changement de coût fournisseur, là où un
            prix figé devient une marge négative dès que le coût monte.
          */}
          <Select
            label="Margin mode"
            value={form.margin_mode}
            onChange={(e) =>
              setForm((f) => ({
                ...f,
                margin_mode: e.target.value as 'global' | 'custom',
                // Pré-remplit avec le global : repartir de zéro ferait
                // chuter le prix si l'on enregistre sans y penser.
                custom_margin: f.custom_margin || String(globalMargin),
              }))
            }
            options={[
              { value: 'global', label: `Use global margin (${globalMargin}%)` },
              { value: 'custom', label: 'Custom margin' },
            ]}
          />

          {form.margin_mode === 'custom' && (
            <Input
              label="Custom margin (%)"
              type="number"
              step="0.01"
              min={MARGIN_MIN}
              max={MARGIN_MAX}
              value={form.custom_margin}
              onChange={(e) => setForm((f) => ({ ...f, custom_margin: e.target.value }))}
            />
          )}

          {/* Prix calculé, mis à jour à la frappe : l'effet de la marge
              se voit avant d'enregistrer. */}
          <Input
            label="Calculated selling price / 1000"
            value={
              editing
                ? rate(
                    sellingPrice(
                      Number(editing.provider_rate),
                      form.margin_mode === 'custom'
                        ? Number(form.custom_margin || 0)
                        : globalMargin
                    )
                  )
                : ''
            }
            readOnly
            hint="Provider cost x (1 + margin). Stored when you save."
          />
          <Input
            label="Minimum quantity"
            type="number"
            min={1}
            value={form.min}
            onChange={(e) => setForm((f) => ({ ...f, min: Number(e.target.value) }))}
          />
          <Input
            label="Maximum quantity"
            type="number"
            min={1}
            value={form.max}
            onChange={(e) => setForm((f) => ({ ...f, max: Number(e.target.value) }))}
          />
        </div>
      </Modal>
    </>
  );
}
