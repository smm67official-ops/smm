'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { Button, Icon, Modal, Textarea, useToast } from '@/design-system';
import type { AdminTopUpRequest, TopUpStatus } from '@/lib/supabase/types';

const STATUS_PILL: Record<TopUpStatus, string> = {
  pending: 'gp-pill--warning',
  approved: 'gp-pill--success',
  rejected: 'gp-pill--danger',
  canceled: 'gp-pill--neutral',
};

const money = (value: number) => `$${Number(value ?? 0).toFixed(2)}`;
const datetime = (iso: string) =>
  new Date(iso).toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short' });

/**
 * File d'attente des recharges.
 *
 * Approuver appelle `wallet_apply` côté serveur — c'est le seul chemin
 * qui crédite un portefeuille. Le bouton se verrouille pendant l'appel :
 * un double clic ne doit pas produire deux crédits.
 */
export default function AdminTopUpsTable({ requests }: { requests: AdminTopUpRequest[] }) {
  const router = useRouter();
  const { toast } = useToast();

  const [busyId, setBusyId] = useState<string | null>(null);
  const [rejecting, setRejecting] = useState<AdminTopUpRequest | null>(null);
  const [note, setNote] = useState('');

  const settle = async (
    request: AdminTopUpRequest,
    decision: 'approved' | 'rejected',
    reviewNote?: string
  ) => {
    setBusyId(request.id);

    const response = await fetch(`/api/admin/topups/${request.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ decision, note: reviewNote }),
    });
    const result = await response.json().catch(() => ({}));
    setBusyId(null);

    if (!response.ok) {
      toast({ tone: 'error', title: 'Could not settle the request', description: result.error });
      return;
    }

    toast({
      tone: 'success',
      title:
        decision === 'approved'
          ? `${money(Number(request.amount) + Number(request.bonus ?? 0))} credited to ${request.email ?? 'the customer'}`
          : 'Request declined',
      description: decision === 'approved' ? `New balance: ${money(result.balance)}` : undefined,
    });

    setRejecting(null);
    setNote('');
    router.refresh();
  };

  if (requests.length === 0) {
    return (
      <div className="gp-empty">
        <span className="gp-empty__icon">
          <Icon name="card" size={22} />
        </span>
        <p style={{ margin: 0 }}>No top-up request.</p>
      </div>
    );
  }

  return (
    <>
      <div className="gp-table-wrap">
        <table className="gp-table rs-table">
          <thead>
            <tr>
              <th>Request</th>
              <th>Customer</th>
              <th className="gp-table__num">Amount</th>
              <th className="gp-table__num">To credit</th>
              <th className="gp-table__num">Balance</th>
              <th>Status</th>
              <th className="rs-col-optional">Requested</th>
              <th className="gp-table__num">Actions</th>
            </tr>
          </thead>
          <tbody>
            {requests.map((request) => (
              <tr key={request.id}>
                <td data-label="Request" className="gp-table__strong">
                  #{request.id.slice(0, 8).toUpperCase()}
                </td>

                <td data-label="Customer" className="rs-cell--head">
                  <div className="gp-cell-stack">
                    <span className="gp-avatar">
                      {(request.full_name ?? request.email ?? '?').slice(0, 2).toUpperCase()}
                    </span>
                    <span style={{ minWidth: 0 }}>
                      <span className="gp-table__strong" style={{ display: 'block' }}>
                        {request.full_name || request.username || '—'}
                      </span>
                      <span className="gp-table__muted">{request.email ?? request.user_id.slice(0, 8)}</span>
                    </span>
                  </div>
                </td>

                <td className="gp-table__num" data-label="Amount">
                  {money(Number(request.amount))}
                  {Number(request.bonus) > 0 && (
                    <div className="gp-table__muted">+{money(Number(request.bonus))} bonus</div>
                  )}
                </td>

                {/* Ce que `wallet_apply` va réellement créditer. */}
                <td className="gp-table__num gp-table__strong" data-label="To credit">
                  {money(Number(request.amount) + Number(request.bonus ?? 0))}
                </td>

                <td className="gp-table__num" data-label="Balance">
                  {money(Number(request.balance))}
                </td>

                <td data-label="Status">
                  <span className={`gp-pill ${STATUS_PILL[request.status]}`}>
                    <span className="gp-pill__dot" />
                    {request.status}
                  </span>
                </td>

                <td className="gp-table__muted rs-col-optional" data-label="Requested">
                  {datetime(request.created_at)}
                </td>

                <td data-label="">
                  <div className="gp-table__actions">
                    {request.status === 'pending' ? (
                      <>
                        <button
                          type="button"
                          className="gp-btn gp-btn--sm gp-btn--primary"
                          disabled={busyId === request.id}
                          onClick={() => void settle(request, 'approved')}
                        >
                          <Icon name="check" size={13} />
                          Credit
                        </button>
                        <button
                          type="button"
                          className="gp-btn gp-btn--sm gp-btn--danger"
                          disabled={busyId === request.id}
                          onClick={() => setRejecting(request)}
                        >
                          Decline
                        </button>
                      </>
                    ) : (
                      <span className="gp-table__muted">
                        {request.reviewed_at ? datetime(request.reviewed_at) : '—'}
                      </span>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Modal
        open={Boolean(rejecting)}
        onClose={() => setRejecting(null)}
        size="sm"
        title="Decline this request?"
        description={rejecting ? `${money(Number(rejecting.amount))} — ${rejecting.email ?? rejecting.user_id.slice(0, 8)}` : ''}
        footer={
          <>
            <Button variant="secondary" onClick={() => setRejecting(null)}>
              Cancel
            </Button>
            <Button
              variant="danger"
              loading={busyId === rejecting?.id}
              onClick={() => rejecting && void settle(rejecting, 'rejected', note)}
            >
              Decline
            </Button>
          </>
        }
      >
        <Textarea
          label="Reason"
          rows={3}
          placeholder="Visible in the audit trail (optional)"
          value={note}
          onChange={(event) => setNote(event.target.value)}
        />
      </Modal>
    </>
  );
}
