'use client';

import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { useRef, useState } from 'react';
import { Button, Icon, Input, Modal, Textarea, useToast } from '@/design-system';
import {
  ICON_MAX_BYTES,
  ICON_MIME_TYPES,
  messageFor,
  normalizeRib,
  RIB_LENGTH,
} from '@/lib/settings-validation';
import type { PaymentMethod } from '@/lib/supabase/types';

type Draft = {
  name: string;
  account_number: string;
  rib: string;
  instructions: string;
  position: string;
  is_active: boolean;
};

const EMPTY: Draft = {
  name: '',
  account_number: '',
  rib: '',
  instructions: '',
  position: '0',
  is_active: true,
};

/**
 * Moyens de paiement.
 *
 * Plusieurs peuvent être actifs en même temps — c'est la différence avec
 * les numéros WhatsApp. Seuls les actifs sont montrés au client, et toute
 * modification prend effet à sa prochaine page : rien n'est mis en cache.
 */
export default function PaymentMethods({ methods }: { methods: PaymentMethod[] }) {
  const router = useRouter();
  const { toast } = useToast();

  const [editing, setEditing] = useState<PaymentMethod | null>(null);
  const [creating, setCreating] = useState(false);
  const [draft, setDraft] = useState<Draft>(EMPTY);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);

  /** Icône choisie mais pas encore envoyée, et aperçu local. */
  const [iconFile, setIconFile] = useState<File | null>(null);
  const [iconPreview, setIconPreview] = useState<string | null>(null);
  const [removeIcon, setRemoveIcon] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const resetIcon = () => {
    setIconFile(null);
    setIconPreview(null);
    setRemoveIcon(false);
    if (fileRef.current) fileRef.current.value = '';
  };

  const openCreate = () => {
    setDraft(EMPTY);
    setError(null);
    resetIcon();
    setCreating(true);
  };

  const openEdit = (method: PaymentMethod) => {
    setDraft({
      name: method.name,
      account_number: method.account_number ?? '',
      rib: method.rib ?? '',
      instructions: method.instructions ?? '',
      position: String(method.position ?? 0),
      is_active: method.is_active,
    });
    setError(null);
    resetIcon();
    setEditing(method);
  };

  const close = () => {
    setCreating(false);
    setEditing(null);
    setError(null);
    resetIcon();
  };

  const pickIcon = (file: File | null) => {
    if (!file) {
      resetIcon();
      return;
    }

    // Contrôlé ici pour un retour immédiat ; le serveur revérifie.
    if (!ICON_MIME_TYPES.includes(file.type)) {
      setError(messageFor('ICON_TYPE'));
      return;
    }
    if (file.size > ICON_MAX_BYTES) {
      setError(messageFor('ICON_TOO_LARGE'));
      return;
    }

    setError(null);
    setIconFile(file);
    setRemoveIcon(false);
    setIconPreview(URL.createObjectURL(file));
  };

  const save = async () => {
    if (!draft.name.trim()) {
      setError(messageFor('NAME_REQUIRED'));
      return;
    }

    const rib = normalizeRib(draft.rib);
    if (rib && !/^\d+$/.test(rib)) {
      setError(messageFor('RIB_NOT_NUMERIC'));
      return;
    }
    if (rib && rib.length !== RIB_LENGTH) {
      setError(messageFor('RIB_LENGTH'));
      return;
    }
    if (!draft.account_number.trim() && !rib) {
      setError(messageFor('REACHABLE_REQUIRED'));
      return;
    }

    setSaving(true);
    setError(null);

    const form = new FormData();
    form.set('name', draft.name);
    form.set('account_number', draft.account_number);
    form.set('rib', rib);
    form.set('instructions', draft.instructions);
    form.set('position', draft.position || '0');
    form.set('is_active', String(draft.is_active));
    if (iconFile) form.set('icon', iconFile);
    if (removeIcon) form.set('remove_icon', 'true');

    const url = editing ? `/api/admin/payment-methods/${editing.id}` : '/api/admin/payment-methods';
    const response = await fetch(url, { method: editing ? 'PATCH' : 'POST', body: form });
    const result = await response.json().catch(() => ({}));
    setSaving(false);

    if (!response.ok) {
      setError(result.error ?? 'Could not save this payment method.');
      return;
    }

    toast({ tone: 'success', title: editing ? 'Payment method updated' : 'Payment method added' });
    close();
    router.refresh();
  };

  const toggle = async (method: PaymentMethod) => {
    setBusyId(method.id);

    const response = await fetch(`/api/admin/payment-methods/${method.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ is_active: !method.is_active }),
    });
    const result = await response.json().catch(() => ({}));
    setBusyId(null);

    if (!response.ok) {
      toast({ tone: 'error', title: 'Could not update', description: result.error });
      return;
    }

    toast({
      tone: 'success',
      title: method.is_active ? `${method.name} hidden from clients` : `${method.name} is now visible`,
    });
    router.refresh();
  };

  const remove = async (method: PaymentMethod) => {
    setBusyId(method.id);

    const response = await fetch(`/api/admin/payment-methods/${method.id}`, { method: 'DELETE' });
    const result = await response.json().catch(() => ({}));
    setBusyId(null);

    if (!response.ok) {
      toast({ tone: 'error', title: 'Could not delete', description: result.error });
      return;
    }

    toast({ tone: 'success', title: `${method.name} deleted` });
    router.refresh();
  };

  const activeCount = methods.filter((m) => m.is_active).length;
  const currentIcon = iconPreview ?? (removeIcon ? null : (editing?.icon_url ?? null));

  return (
    <section className="gp-card">
      <header className="gp-card-head">
        <div>
          <p className="gp-card-head__eyebrow">Wallet</p>
          <h3 className="gp-card-head__title">Payment methods</h3>
          <p className="gp-card-head__desc">
            Shown to clients when they top up their wallet. Several can be active at once; inactive
            ones are never displayed.
          </p>
        </div>
        <div className="gp-hero__actions">
          <Button size="sm" onClick={openCreate}>
            <Icon name="plus" size={15} /> Add method
          </Button>
        </div>
      </header>

      <p className="gp-card-head__desc" style={{ padding: '0 var(--sv-space-5)' }}>
        {activeCount === 0
          ? 'No active method: clients see no way to pay when topping up.'
          : `${activeCount} active method${activeCount > 1 ? 's' : ''} visible to clients.`}
      </p>

      {methods.length === 0 ? (
        <div className="gp-empty">
          <span className="gp-empty__icon">
            <Icon name="card" size={22} />
          </span>
          <p style={{ margin: 0 }}>No payment method configured yet.</p>
        </div>
      ) : (
        <div className="gp-table-wrap">
          <table className="gp-table rs-table">
            <thead>
              <tr>
                <th>Method</th>
                <th>Account</th>
                <th className="rs-col-optional">RIB</th>
                <th>Status</th>
                <th className="gp-table__num">Actions</th>
              </tr>
            </thead>
            <tbody>
              {methods.map((method) => (
                <tr key={method.id}>
                  <td data-label="Method" className="rs-cell--head">
                    <div className="gp-cell-stack">
                      {method.icon_url ? (
                        <Image
                          src={method.icon_url}
                          alt=""
                          width={32}
                          height={32}
                          style={{ borderRadius: 8, objectFit: 'contain' }}
                          unoptimized
                        />
                      ) : (
                        <span className="gp-avatar">{method.name.slice(0, 2).toUpperCase()}</span>
                      )}
                      <span className="gp-table__strong">{method.name}</span>
                    </div>
                  </td>
                  <td data-label="Account">{method.account_number || '—'}</td>
                  <td data-label="RIB" className="gp-table__muted rs-col-optional">
                    {method.rib || '—'}
                  </td>
                  <td data-label="Status">
                    <span
                      className={`gp-pill ${method.is_active ? 'gp-pill--success' : 'gp-pill--neutral'}`}
                    >
                      <span className="gp-pill__dot" />
                      {method.is_active ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  <td className="gp-table__num" data-label="Actions">
                    <div className="gp-table__actions">
                      <Button
                        size="sm"
                        variant="ghost"
                        disabled={busyId === method.id}
                        onClick={() => toggle(method)}
                      >
                        {method.is_active ? 'Deactivate' : 'Activate'}
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => openEdit(method)}>
                        Edit
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        disabled={busyId === method.id}
                        onClick={() => remove(method)}
                        aria-label={`Delete ${method.name}`}
                      >
                        <Icon name="trash" size={15} />
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Modal
        open={creating || editing !== null}
        onClose={close}
        size="lg"
        title={editing ? `Edit ${editing.name}` : 'Add a payment method'}
        footer={
          <>
            <Button variant="ghost" onClick={close}>
              Cancel
            </Button>
            <Button onClick={save} loading={saving}>
              {editing ? 'Save' : 'Add'}
            </Button>
          </>
        }
      >
        <div className="gp-field">
          <Input
            label="Name"
            placeholder="Cash Plus, Wafacash, Bank transfer…"
            value={draft.name}
            onChange={(e) => setDraft({ ...draft, name: e.target.value })}
          />

          <Input
            label="Account number"
            optional
            placeholder="0612345678, 1234 5678…"
            value={draft.account_number}
            onChange={(e) => setDraft({ ...draft, account_number: e.target.value })}
            hint="The number or identifier the client pays to."
          />

          <Input
            label="RIB"
            optional
            placeholder="24 digits"
            value={draft.rib}
            onChange={(e) => setDraft({ ...draft, rib: e.target.value })}
            hint={`Bank transfers only — exactly ${RIB_LENGTH} digits. Spaces are ignored.`}
          />

          <Textarea
            label="Instructions"
            optional
            rows={3}
            placeholder="Send the receipt once paid…"
            value={draft.instructions}
            onChange={(e) => setDraft({ ...draft, instructions: e.target.value })}
          />

          {/* --- Icône --- */}
          <div>
            <label className="sv-label" htmlFor="pm-icon">
              Icon <span className="sv-label__optional">— optional</span>
            </label>

            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--sv-space-3)' }}>
              {currentIcon ? (
                <Image
                  src={currentIcon}
                  alt=""
                  width={44}
                  height={44}
                  style={{ borderRadius: 10, objectFit: 'contain' }}
                  unoptimized
                />
              ) : (
                <span className="gp-avatar" aria-hidden="true">
                  {(draft.name || '?').slice(0, 2).toUpperCase()}
                </span>
              )}

              <input
                id="pm-icon"
                ref={fileRef}
                type="file"
                accept={ICON_MIME_TYPES.join(',')}
                onChange={(e) => pickIcon(e.target.files?.[0] ?? null)}
                className="gp-input"
                style={{ flex: 1, minWidth: 0 }}
              />

              {currentIcon && (
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => {
                    setIconFile(null);
                    setIconPreview(null);
                    setRemoveIcon(true);
                    if (fileRef.current) fileRef.current.value = '';
                  }}
                >
                  Remove
                </Button>
              )}
            </div>
            <span className="sv-hint">PNG, JPEG, WebP or SVG — 512 KB max.</span>
          </div>

          <Input
            label="Position"
            optional
            type="number"
            value={draft.position}
            onChange={(e) => setDraft({ ...draft, position: e.target.value })}
            hint="Lower shows first in the client list."
          />

          <label style={{ display: 'flex', alignItems: 'center', gap: 'var(--sv-space-2)' }}>
            <input
              type="checkbox"
              checked={draft.is_active}
              onChange={(e) => setDraft({ ...draft, is_active: e.target.checked })}
            />
            <span>Visible to clients</span>
          </label>

          {error && (
            <p className="gp-card-head__desc" role="alert" style={{ color: 'var(--sv-danger)' }}>
              {error}
            </p>
          )}
        </div>
      </Modal>
    </section>
  );
}
