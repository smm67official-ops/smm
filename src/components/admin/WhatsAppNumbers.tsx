'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { Button, Icon, Input, Modal, useToast } from '@/design-system';
import { formatWhatsApp, isValidWhatsApp } from '@/lib/whatsapp';
import type { WhatsAppNumber } from '@/lib/supabase/types';

type Draft = { label: string; number: string; note: string };

const EMPTY: Draft = { label: '', number: '', note: '' };

/**
 * Numéros WhatsApp.
 *
 * Un seul est actif à la fois — la règle est tenue par un index unique en
 * base, pas seulement ici. L'interface se contente de la rendre lisible :
 * activer un numéro désactive le précédent en une seule opération, et le
 * numéro actif ne propose pas de suppression, faute de quoi le panel
 * pourrait se retrouver sans aucun contact.
 */
export default function WhatsAppNumbers({ numbers }: { numbers: WhatsAppNumber[] }) {
  const router = useRouter();
  const { toast } = useToast();

  const [busyId, setBusyId] = useState<string | null>(null);
  const [editing, setEditing] = useState<WhatsAppNumber | null>(null);
  const [creating, setCreating] = useState(false);
  const [draft, setDraft] = useState<Draft>(EMPTY);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const active = numbers.find((n) => n.is_active) ?? null;

  const openCreate = () => {
    setDraft(EMPTY);
    setError(null);
    setCreating(true);
  };

  const openEdit = (number: WhatsAppNumber) => {
    setDraft({ label: number.label, number: number.number, note: number.note ?? '' });
    setError(null);
    setEditing(number);
  };

  const close = () => {
    setCreating(false);
    setEditing(null);
    setError(null);
  };

  const save = async () => {
    if (!draft.label.trim()) {
      setError('A label is required.');
      return;
    }
    if (!isValidWhatsApp(draft.number)) {
      setError('Enter a valid number (8 to 15 digits, international format).');
      return;
    }

    setSaving(true);
    setError(null);

    const url = editing ? `/api/admin/whatsapp/${editing.id}` : '/api/admin/whatsapp';
    const response = await fetch(url, {
      method: editing ? 'PATCH' : 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        label: draft.label,
        number: draft.number,
        note: draft.note,
        // Le tout premier numéro est activé côté serveur : sans lui, le
        // panel resterait sans contact jusqu'à un second geste.
        activate: !editing && numbers.length === 0,
      }),
    });

    const result = await response.json().catch(() => ({}));
    setSaving(false);

    if (!response.ok) {
      setError(result.error ?? 'Could not save this number.');
      return;
    }

    toast({ tone: 'success', title: editing ? 'Number updated' : 'Number added' });
    close();
    router.refresh();
  };

  const activate = async (number: WhatsAppNumber) => {
    setBusyId(number.id);

    const response = await fetch(`/api/admin/whatsapp/${number.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ activate: true }),
    });
    const result = await response.json().catch(() => ({}));
    setBusyId(null);

    if (!response.ok) {
      toast({ tone: 'error', title: 'Could not activate', description: result.error });
      return;
    }

    toast({
      tone: 'success',
      title: `${number.label} is now the active number`,
      description: 'It applies immediately to every WhatsApp flow.',
    });
    router.refresh();
  };

  const remove = async (number: WhatsAppNumber) => {
    setBusyId(number.id);

    const response = await fetch(`/api/admin/whatsapp/${number.id}`, { method: 'DELETE' });
    const result = await response.json().catch(() => ({}));
    setBusyId(null);

    if (!response.ok) {
      toast({ tone: 'error', title: 'Could not delete', description: result.error });
      return;
    }

    toast({ tone: 'success', title: 'Number removed' });
    router.refresh();
  };

  return (
    <section className="gp-card">
      <header className="gp-card-head">
        <div>
          <p className="gp-card-head__eyebrow">Contact</p>
          <h3 className="gp-card-head__title">WhatsApp numbers</h3>
          <p className="gp-card-head__desc">
            Exactly one number is active. It is the number used everywhere clients reach you on
            WhatsApp — orders, top-ups and support.
          </p>
        </div>
        <div className="gp-hero__actions">
          <Button size="sm" onClick={openCreate}>
            <Icon name="plus" size={15} /> Add number
          </Button>
        </div>
      </header>

      {active ? (
        <p className="gp-card-head__desc" style={{ padding: '0 var(--sv-space-5)' }}>
          Currently active: <strong>{formatWhatsApp(active.number)}</strong> — {active.label}
        </p>
      ) : (
        <p className="gp-card-head__desc" style={{ padding: '0 var(--sv-space-5)' }}>
          No active number: WhatsApp steps are hidden from clients until you activate one.
        </p>
      )}

      {numbers.length === 0 ? (
        <div className="gp-empty">
          <span className="gp-empty__icon">
            <Icon name="info" size={22} />
          </span>
          <p style={{ margin: 0 }}>No number configured yet.</p>
        </div>
      ) : (
        <div className="gp-table-wrap">
          <table className="gp-table rs-table">
            <thead>
              <tr>
                <th>Label</th>
                <th>Number</th>
                <th className="rs-col-optional">Note</th>
                <th>Status</th>
                <th className="gp-table__num">Actions</th>
              </tr>
            </thead>
            <tbody>
              {numbers.map((number) => (
                <tr key={number.id}>
                  <td data-label="Label" className="gp-table__strong rs-cell--head">
                    {number.label}
                  </td>
                  <td data-label="Number">{formatWhatsApp(number.number)}</td>
                  <td data-label="Note" className="gp-table__muted rs-col-optional">
                    {number.note || '—'}
                  </td>
                  <td data-label="Status">
                    <span
                      className={`gp-pill ${number.is_active ? 'gp-pill--success' : 'gp-pill--neutral'}`}
                    >
                      <span className="gp-pill__dot" />
                      {number.is_active ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  <td className="gp-table__num" data-label="Actions">
                    <div className="gp-table__actions">
                      {!number.is_active && (
                        <Button
                          size="sm"
                          variant="ghost"
                          disabled={busyId === number.id}
                          onClick={() => activate(number)}
                        >
                          Activate
                        </Button>
                      )}
                      <Button size="sm" variant="ghost" onClick={() => openEdit(number)}>
                        Edit
                      </Button>
                      {/* Le numéro actif n'est pas supprimable : il faut
                          d'abord en activer un autre. */}
                      {!number.is_active && (
                        <Button
                          size="sm"
                          variant="ghost"
                          disabled={busyId === number.id}
                          onClick={() => remove(number)}
                          aria-label={`Delete ${number.label}`}
                        >
                          <Icon name="trash" size={15} />
                        </Button>
                      )}
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
        title={editing ? 'Edit number' : 'Add a WhatsApp number'}
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
            label="Label"
            placeholder="Support, Sales…"
            value={draft.label}
            onChange={(e) => setDraft({ ...draft, label: e.target.value })}
          />
          <Input
            label="Number"
            placeholder="+212 6 03 22 74 36"
            value={draft.number}
            onChange={(e) => setDraft({ ...draft, number: e.target.value })}
            hint="International format. A local number starting with 0 gets the default country code."
          />
          <Input
            label="Note (optional)"
            placeholder="Opening hours, team…"
            value={draft.note}
            onChange={(e) => setDraft({ ...draft, note: e.target.value })}
          />
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
