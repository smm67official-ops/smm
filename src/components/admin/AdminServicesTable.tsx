'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { Button, Icon, Input, Modal, useToast } from '@/design-system';
import { platformOf } from '@/lib/platforms';
import type { Service } from '@/lib/supabase/types';

const rate = (value: number) =>
  `$${Number(value ?? 0).toFixed(5).replace(/0+$/, '').replace(/\.$/, '')}`;

export default function AdminServicesTable({
  locale,
  services,
}: {
  locale: string;
  services: Service[];
}) {
  const router = useRouter();
  const { toast } = useToast();

  const [editing, setEditing] = useState<Service | null>(null);
  const [form, setForm] = useState({ name: '', rate: 0, min: 0, max: 0 });
  const [busy, setBusy] = useState(false);
  const [togglingId, setTogglingId] = useState<string | null>(null);

  const openEdit = (service: Service) => {
    setForm({
      name: service.name,
      rate: Number(service.rate),
      min: service.min,
      max: service.max,
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
      rate: Number(form.rate),
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

  /** Rend le prix à nouveau calculé par la marge automatique. */
  const unlockRate = async () => {
    if (!editing) return;
    setBusy(true);

    const { ok, result } = await patch(editing.id, { unlockRate: true });
    setBusy(false);

    if (!ok) {
      toast({ tone: 'error', title: 'Update failed', description: result.error });
      return;
    }

    toast({
      tone: 'success',
      title: 'Price unlocked',
      description: 'The next catalogue sync will recompute it from the margin.',
    });
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

  const margin = (service: Service) => {
    const cost = Number(service.provider_rate);
    if (!cost) return '—';
    return `${(((Number(service.rate) - cost) / cost) * 100).toFixed(0)}%`;
  };

  return (
    <>
      <div className="gp-table-wrap">
        <table className="gp-table rs-table">
          <thead>
            <tr>
              <th>ID</th>
              <th>Service</th>
              <th>Type</th>
              <th className="gp-table__num">Cost / 1000</th>
              <th className="gp-table__num">Sell / 1000</th>
              <th className="gp-table__num">Margin</th>
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
                  <td className="gp-table__muted" data-label="ID">{service.provider_service_id}</td>
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
                  <td className="gp-table__num" data-label="Margin">{margin(service)}</td>
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
          <Input
            label="Selling price / 1000"
            type="number"
            step="0.00001"
            min={0}
            value={form.rate}
            onChange={(e) => setForm((f) => ({ ...f, rate: Number(e.target.value) }))}
            hint={
              editing?.rate_locked
                ? 'Locked: this price survives every catalogue sync.'
                : `Currently automatic (provider cost + margin). Saving locks it.`
            }
          />

          {editing?.rate_locked && (
            <button type="button" className="gp-btn gp-btn--sm" onClick={unlockRate} disabled={busy}>
              <Icon name="refresh" size={13} />
              Back to automatic margin
            </button>
          )}
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
