'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Badge, Button, Icon, Input, Modal, Textarea, useToast } from '@/design-system';
import type { WalletTransaction } from '@/lib/supabase/types';

const money = (value: number | null | undefined) =>
  value === null || value === undefined ? '—' : `$${Number(value).toFixed(2)}`;

const datetime = (iso: string) =>
  new Date(iso).toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short' });

type Operation = 'allocate' | 'reclaim';

type ProviderState = {
  provider: { status: 'LIVE' | 'STALE' | 'ERROR'; balance: number | null; checkedAt: string | null; error: string | null };
  allocated: number;
  available: number | null;
};

/**
 * Allocation et reprise de solde.
 *
 * Le disponible affiché est relu à chaque ouverture : décider sur un
 * chiffre gardé en mémoire depuis la page précédente reviendrait à ne
 * pas vérifier. Le serveur le relit de toute façon avant d'écrire — ce
 * qui est montré ici sert à décider, pas à autoriser.
 */
export default function BalanceModal({
  open,
  onClose,
  customer,
}: {
  open: boolean;
  onClose: () => void;
  customer: { id: string; name: string; balance: number } | null;
}) {
  const router = useRouter();
  const { toast } = useToast();

  const [operation, setOperation] = useState<Operation>('allocate');
  const [amount, setAmount] = useState('');
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [state, setState] = useState<ProviderState | null>(null);
  const [loadingState, setLoadingState] = useState(false);
  const [history, setHistory] = useState<WalletTransaction[]>([]);

  const load = useCallback(async () => {
    setLoadingState(true);
    const response = await fetch('/api/admin/balance');
    const result = await response.json().catch(() => null);
    setState(response.ok ? result : null);
    setLoadingState(false);
  }, []);

  useEffect(() => {
    if (!open || !customer) return;

    setOperation('allocate');
    setAmount('');
    setReason('');
    setError(null);
    setHistory([]);
    void load();

    void fetch(`/api/admin/users/${customer.id}/transactions`)
      .then((r) => (r.ok ? r.json() : null))
      .then((r) => setHistory(r?.transactions ?? []))
      .catch(() => setHistory([]));
  }, [open, customer, load]);

  if (!customer) return null;

  const value = Number(amount.replace(',', '.'));
  const valid = Number.isFinite(value) && value > 0;

  const available = state?.available ?? null;

  // Projection affichée avant confirmation : ce que deviendront les deux
  // soldes si l'opération aboutit.
  const clientAfter = valid
    ? operation === 'allocate'
      ? customer.balance + value
      : customer.balance - value
    : null;

  const availableAfter =
    valid && available !== null
      ? operation === 'allocate'
        ? available - value
        : available + value
      : null;

  const blockedReason =
    !valid
      ? null
      : operation === 'allocate' && available !== null && value > available
        ? `Only ${money(available)} is available from SMMGen.`
        : operation === 'reclaim' && value > customer.balance
          ? `The client only holds ${money(customer.balance)}.`
          : operation === 'allocate' && state?.provider.status === 'ERROR'
            ? 'The SMMGen balance is unavailable — allocation is blocked.'
            : null;

  const submit = async () => {
    if (!valid || blockedReason) return;

    setBusy(true);
    setError(null);

    const response = await fetch('/api/admin/balance', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId: customer.id, amount: value, operation, reason }),
    });
    const result = await response.json().catch(() => ({}));
    setBusy(false);

    if (!response.ok) {
      setError(result.error ?? 'The operation failed.');
      // Le disponible a pu changer entre l'affichage et l'envoi : on le
      // relit pour que l'écran cesse de montrer un chiffre démenti.
      void load();
      return;
    }

    toast({
      tone: 'success',
      title:
        operation === 'allocate'
          ? `${money(value)} allocated to ${customer.name}`
          : `${money(value)} reclaimed from ${customer.name}`,
      description: `New client balance: ${money(result.balance)}`,
    });

    onClose();
    router.refresh();
  };

  const statusTone =
    state?.provider.status === 'LIVE' ? 'success' : state?.provider.status === 'STALE' ? 'warning' : 'error';

  return (
    <Modal
      open={open}
      onClose={onClose}
      size="lg"
      title={operation === 'allocate' ? 'Add balance' : 'Remove balance'}
      description={customer.name}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button loading={busy} disabled={!valid || Boolean(blockedReason)} onClick={submit}>
            Confirm
          </Button>
        </>
      }
    >
      <div className="sv-stack" style={{ gap: 'var(--sv-space-4)' }}>
        <div className="gp-table__actions">
          <Button
            size="sm"
            variant={operation === 'allocate' ? 'primary' : 'ghost'}
            onClick={() => setOperation('allocate')}
          >
            <Icon name="plus" size={14} /> Add balance
          </Button>
          <Button
            size="sm"
            variant={operation === 'reclaim' ? 'primary' : 'ghost'}
            onClick={() => setOperation('reclaim')}
          >
            <Icon name="minus" size={14} /> Remove balance
          </Button>
        </div>

        {/* --- Situation actuelle --- */}
        <div className="gp-card__inner">
          <p className="gp-card-head__eyebrow">
            SMMGen balance{' '}
            <Badge tone={statusTone as 'success' | 'warning' | 'error'}>
              {loadingState ? 'checking…' : (state?.provider.status ?? 'ERROR')}
            </Badge>
          </p>

          <div className="gp-kv-list">
            <p>
              Provider balance: <strong>{money(state?.provider.balance)}</strong>
            </p>
            <p>
              Already allocated to clients: <strong>{money(state?.allocated)}</strong>
            </p>
            <p>
              Available to allocate: <strong>{money(available)}</strong>
            </p>
            <p>
              Current client balance: <strong>{money(customer.balance)}</strong>
            </p>
          </div>

          {state?.provider.status !== 'LIVE' && state?.provider.error && (
            <p className="gp-card-head__desc" style={{ color: 'var(--sv-danger)' }}>
              {state.provider.error}
            </p>
          )}
        </div>

        <Input
          label="Amount"
          type="number"
          step="0.01"
          min={0}
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          placeholder="0.00"
        />

        <Textarea
          label="Reason"
          rows={2}
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder="Recorded in the audit trail."
          hint="Required — this movement is permanent and auditable."
        />

        {/* --- Projection avant confirmation --- */}
        {valid && (
          <div className="gp-card__inner">
            <p className="gp-card-head__eyebrow">After this operation</p>
            <div className="gp-kv-list">
              <p>
                Client balance: <strong>{money(clientAfter)}</strong>
              </p>
              <p>
                {operation === 'allocate' ? 'Available at SMMGen' : 'Returned to available'}:{' '}
                <strong>{money(availableAfter)}</strong>
              </p>
            </div>
          </div>
        )}

        {blockedReason && (
          <p className="tm-alert tm-alert-error" role="alert" style={{ margin: 0 }}>
            {blockedReason}
          </p>
        )}
        {error && (
          <p className="tm-alert tm-alert-error" role="alert" style={{ margin: 0 }}>
            {error}
          </p>
        )}

        {/* --- Historique --- */}
        {history.length > 0 && (
          <div>
            <p className="gp-card-head__eyebrow">Recent movements</p>
            <div className="gp-table-wrap">
              <table className="gp-table">
                <tbody>
                  {history.slice(0, 8).map((t) => (
                    <tr key={t.id}>
                      <td className="gp-table__muted">{datetime(t.created_at)}</td>
                      <td>{t.type}</td>
                      <td className="gp-table__num gp-table__strong">
                        {Number(t.amount) >= 0 ? '+' : ''}
                        {money(Number(t.amount))}
                      </td>
                      <td className="gp-table__num gp-table__muted">{money(Number(t.balance_after))}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
}
