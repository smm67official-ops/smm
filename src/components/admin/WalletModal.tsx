'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  Badge,
  Button,
  Icon,
  Input,
  Modal,
  Select,
  Textarea,
  useToast,
} from '@/design-system';
import { createClient } from '@/lib/supabase/client';
import type { WalletTransaction, WalletTransactionType } from '@/lib/supabase/types';

const money = (value: number) => `$${Number(value ?? 0).toFixed(2)}`;

const TYPE_OPTIONS = [
  { value: 'CREDIT', label: 'Credit — add funds' },
  { value: 'DEBIT', label: 'Debit — remove funds' },
  { value: 'REFUND', label: 'Refund — give money back' },
  { value: 'ADJUSTMENT', label: 'Adjustment — signed correction' },
];

const TONE: Record<WalletTransactionType, 'success' | 'error' | 'info' | 'neutral'> = {
  CREDIT: 'success',
  REFUND: 'success',
  DEBIT: 'error',
  ADJUSTMENT: 'info',
  BALANCE_ALLOCATION: 'success',
  BALANCE_RECLAIM: 'error',
};

export default function WalletModal({
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

  const [transactions, setTransactions] = useState<WalletTransaction[]>([]);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({ type: 'CREDIT', amount: '', reason: '' });

  // L'historique est lisible par un admin grâce à la policy RLS.
  useEffect(() => {
    if (!open || !customer) return;

    const load = async () => {
      setLoading(true);
      const supabase = createClient();
      const { data } = await supabase
        .from('wallet_transactions')
        .select('*')
        .eq('user_id', customer.id)
        .order('created_at', { ascending: false })
        .limit(50);

      setTransactions((data ?? []) as WalletTransaction[]);
      setLoading(false);
    };

    void load();
    setForm({ type: 'CREDIT', amount: '', reason: '' });
  }, [open, customer]);

  const submit = async () => {
    if (!customer) return;
    setBusy(true);

    const response = await fetch('/api/admin/wallet', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        userId: customer.id,
        type: form.type,
        amount: Number(form.amount),
        reason: form.reason,
      }),
    });

    const result = await response.json().catch(() => ({}));
    setBusy(false);

    if (!response.ok) {
      toast({ tone: 'error', title: 'Wallet not updated', description: result.error });
      return;
    }

    toast({
      tone: 'success',
      title: `${form.type} applied`,
      description: `New balance: ${money(result.balance)}`,
    });

    setForm({ type: 'CREDIT', amount: '', reason: '' });
    router.refresh();
    onClose();
  };

  const amountValid = Number.isFinite(Number(form.amount)) && Number(form.amount) !== 0;
  const canSubmit = amountValid && form.reason.trim().length > 0;

  return (
    <Modal
      open={open}
      onClose={onClose}
      size="lg"
      title={customer ? `Wallet — ${customer.name}` : 'Wallet'}
      description="Every movement is written to an immutable ledger."
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Close
          </Button>
          <Button loading={busy} onClick={submit} disabled={!canSubmit}>
            Apply movement
          </Button>
        </>
      }
    >
      {customer && (
        <div className="sv-stack" style={{ gap: 'var(--sv-space-5)' }}>
          <div className="sv-ordercharge">
            <span>Current balance</span>
            <b>{money(customer.balance)}</b>
          </div>

          <div className="sv-grid sv-grid--2" style={{ gap: 'var(--sv-space-4)' }}>
            <Select
              label="Movement"
              value={form.type}
              onChange={(e) => setForm((f) => ({ ...f, type: e.target.value }))}
              options={TYPE_OPTIONS}
            />
            <Input
              label="Amount"
              type="number"
              step="0.01"
              placeholder="25.00"
              value={form.amount}
              onChange={(e) => setForm((f) => ({ ...f, amount: e.target.value }))}
              hint={
                form.type === 'ADJUSTMENT'
                  ? 'Signed: use a negative value to remove funds.'
                  : 'Positive value.'
              }
            />
          </div>

          <Textarea
            label="Reason (required)"
            rows={2}
            placeholder="Bank transfer received on 16/08, ref. 4821"
            value={form.reason}
            onChange={(e) => setForm((f) => ({ ...f, reason: e.target.value }))}
          />

          <div>
            <h4 style={{ fontSize: 'var(--sv-text-h4)' }}>History</h4>
            {loading ? (
              <p className="sv-caption">Loading…</p>
            ) : transactions.length === 0 ? (
              <p className="sv-caption">No movement yet.</p>
            ) : (
              <div style={{ maxHeight: 260, overflowY: 'auto' }}>
                <table className="sv-table">
                  <thead>
                    <tr>
                      <th>Date</th>
                      <th>Type</th>
                      <th style={{ textAlign: 'end' }}>Amount</th>
                      <th style={{ textAlign: 'end' }}>Before</th>
                      <th style={{ textAlign: 'end' }}>After</th>
                      <th>Reason</th>
                    </tr>
                  </thead>
                  <tbody>
                    {transactions.map((tx) => (
                      <tr key={tx.id}>
                        <td className="sv-caption">
                          {new Date(tx.created_at).toLocaleString('en-GB', {
                            dateStyle: 'short',
                            timeStyle: 'short',
                          })}
                        </td>
                        <td>
                          <Badge tone={TONE[tx.type]}>{tx.type}</Badge>
                        </td>
                        <td
                          className="sv-table__numeric sv-table__strong"
                          style={{ color: Number(tx.amount) < 0 ? 'var(--sv-error)' : 'var(--sv-success)' }}
                        >
                          {Number(tx.amount) > 0 ? '+' : ''}
                          {money(Number(tx.amount))}
                        </td>
                        <td className="sv-table__numeric sv-caption">{money(Number(tx.balance_before))}</td>
                        <td className="sv-table__numeric">{money(Number(tx.balance_after))}</td>
                        <td className="sv-caption">
                          {tx.reason ?? '—'}
                          {tx.order_id && (
                            <>
                              {' '}
                              <Icon name="wallet" size={12} /> #{tx.order_id.slice(0, 8)}
                            </>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}
    </Modal>
  );
}
