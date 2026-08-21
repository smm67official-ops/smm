'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import {
  Button,
  Dropdown,
  Icon,
  Input,
  Modal,
  Select,
  Textarea,
  useToast,
} from '@/design-system';
import { ORDER_STATUSES, STATUS_LABEL } from '@/lib/orders';

import type { OrderStatus } from '@/lib/supabase/types';
import type { OrderWithCustomer } from '@/lib/admin-queries';

const STATUS_PILL: Record<string, string> = {
  pending: 'gp-pill--warning',
  processing: 'gp-pill--info',
  in_progress: 'gp-pill--info',
  completed: 'gp-pill--success',
  partial: 'gp-pill--warning',
  canceled: 'gp-pill--neutral',
  failed: 'gp-pill--danger',
  refunded: 'gp-pill--neutral',
};

const money = (value: number) => `$${Number(value ?? 0).toFixed(2)}`;
const datetime = (iso: string) =>
  new Date(iso).toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short' });

export default function AdminOrdersTable({
  locale,
  orders,
}: {
  locale: string;
  orders: OrderWithCustomer[];
}) {
  const router = useRouter();
  const { toast } = useToast();

  const [editing, setEditing] = useState<OrderWithCustomer | null>(null);
  const [deleting, setDeleting] = useState<OrderWithCustomer | null>(null);
  const [status, setStatus] = useState<OrderStatus>('pending');
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);

  const openEdit = (order: OrderWithCustomer) => {
    setEditing(order);
    setStatus(order.status);
    setNote('');
  };

  const saveStatus = async () => {
    if (!editing) return;
    setBusy(true);

    const response = await fetch(`/api/admin/orders/${editing.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status, note: note.trim() || undefined }),
    });
    const result = await response.json().catch(() => ({}));
    setBusy(false);

    if (!response.ok) {
      toast({ tone: 'error', title: 'Failed to update status', description: result.error });
      return;
    }

    toast({ tone: 'success', title: `Order #${editing.id.slice(0, 8)} → ${STATUS_LABEL[status]}` });
    setEditing(null);
    router.refresh();
  };

  const confirmDelete = async () => {
    if (!deleting) return;
    setBusy(true);

    const response = await fetch(`/api/admin/orders/${deleting.id}`, { method: 'DELETE' });
    const result = await response.json().catch(() => ({}));
    setBusy(false);

    if (!response.ok) {
      toast({ tone: 'error', title: 'Failed to delete order', description: result.error });
      return;
    }

    toast({ tone: 'success', title: 'Order deleted' });
    setDeleting(null);
    router.refresh();
  };

  const quickStatus = async (order: OrderWithCustomer, next: OrderStatus) => {
    const response = await fetch(`/api/admin/orders/${order.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: next }),
    });

    if (!response.ok) {
      const result = await response.json().catch(() => ({}));
      toast({ tone: 'error', title: 'Update failed', description: result.error });
      return;
    }

    toast({ tone: 'success', title: `Marked as ${STATUS_LABEL[next]}` });
    router.refresh();
  };

  return (
    <>
      <div className="gp-table-wrap">
        <table className="gp-table rs-table">
          <thead>
            <tr>
              <th>Order ID</th>
              <th>Customer</th>
              <th>Service</th>
              <th className="gp-table__num">Qty</th>
              <th className="gp-table__num">Price</th>
              <th>Status</th>
              <th>Created</th>
              <th className="rs-col-optional">Updated</th>
              <th className="gp-table__num">Actions</th>
            </tr>
          </thead>
          <tbody>
            {orders.map((order) => (
              <tr key={order.id}>
                <td data-label="Order">
                  <Link href={`/${locale}/admin/orders/${order.id}`} className="gp-table__strong">
                    #{order.id.slice(0, 8)}
                  </Link>
                </td>
                <td data-label="Customer" className="rs-cell--head">
                  <div className="gp-cell-stack">
                    <span className="gp-avatar">
                      {(order.first_name ?? order.email).slice(0, 2).toUpperCase()}
                    </span>
                    <span style={{ minWidth: 0 }}>
                      <span className="gp-table__strong" style={{ display: 'block' }}>
                        {[order.first_name, order.last_name].filter(Boolean).join(' ') || '—'}
                      </span>
                      <span className="gp-table__muted">{order.email}</span>
                    </span>
                  </div>
                </td>
                <td data-label="Service">
                  {order.first_service ? (
                    <span title={order.first_service}>
                      {order.first_service.length > 40
                        ? `${order.first_service.slice(0, 40)}…`
                        : order.first_service}
                    </span>
                  ) : (
                    '—'
                  )}
                  {order.items_count > 1 && (
                    <span className="gp-table__muted"> +{order.items_count - 1}</span>
                  )}
                </td>
                <td className="gp-table__num" data-label="Qty">{order.quantity.toLocaleString()}</td>
                <td className="gp-table__num gp-table__strong" data-label="Price">{money(order.total)}</td>
                <td data-label="Status">
                  <span className={`gp-pill ${STATUS_PILL[order.status] ?? 'gp-pill--neutral'}`}>
                    <span className="gp-pill__dot" />
                    {STATUS_LABEL[order.status] ?? order.status}
                  </span>
                </td>
                <td className="gp-table__muted" data-label="Created">{datetime(order.created_at)}</td>
                <td className="gp-table__muted rs-col-optional" data-label="Updated">{datetime(order.updated_at)}</td>
                <td data-label="">
                  <div className="gp-table__actions">
                    <Link
                      href={`/${locale}/admin/orders/${order.id}`}
                      className="gp-btn gp-btn--sm gp-btn--icon"
                      title="Open order"
                    >
                      <Icon name="eye" size={14} />
                    </Link>
                    <Dropdown
                      align="end"
                      trigger={({ toggle }) => (
                        <button
                          type="button"
                          className="gp-btn gp-btn--sm gp-btn--icon"
                          onClick={toggle}
                          aria-label="Actions"
                        >
                          <Icon name="menu" size={15} />
                        </button>
                      )}
                      items={[
                        { type: 'label', id: 'l1', label: 'Manage' },
                        {
                          type: 'item',
                          id: 'edit',
                          label: 'Change status…',
                          icon: <Icon name="refresh" size={14} />,
                          onSelect: () => openEdit(order),
                        },
                        {
                          type: 'item',
                          id: 'complete',
                          label: 'Mark completed',
                          icon: <Icon name="check" size={14} />,
                          onSelect: () => void quickStatus(order, 'completed'),
                        },
                        {
                          type: 'item',
                          id: 'cancel',
                          label: 'Mark canceled',
                          icon: <Icon name="close" size={14} />,
                          onSelect: () => void quickStatus(order, 'canceled'),
                        },
                        { type: 'divider', id: 'd1' },
                        {
                          type: 'item',
                          id: 'delete',
                          label: 'Delete order',
                          danger: true,
                          icon: <Icon name="trash" size={14} />,
                          onSelect: () => setDeleting(order),
                        },
                      ]}
                    />
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Édition du statut */}
      <Modal
        open={Boolean(editing)}
        onClose={() => setEditing(null)}
        title={editing ? `Order #${editing.id.slice(0, 8)}` : ''}
        description={editing?.email}
        footer={
          <>
            <Button variant="secondary" onClick={() => setEditing(null)}>
              Cancel
            </Button>
            <Button loading={busy} onClick={saveStatus}>
              Save changes
            </Button>
          </>
        }
      >
        <div className="sv-stack" style={{ gap: 'var(--sv-space-4)' }}>
          <Select
            label="Status"
            value={status}
            onChange={(e) => setStatus(e.target.value as OrderStatus)}
            options={ORDER_STATUSES.map((s) => ({ value: s, label: STATUS_LABEL[s] }))}
          />
          <Textarea
            label="Note"
            rows={3}
            placeholder="Reason for the change (optional)"
            value={note}
            onChange={(e) => setNote(e.target.value)}
          />
          <Input label="Total" value={editing ? money(editing.total) : ''} readOnly />
        </div>
      </Modal>

      {/* Confirmation de suppression */}
      <Modal
        open={Boolean(deleting)}
        onClose={() => setDeleting(null)}
        size="sm"
        title="Delete this order?"
        description="Items and status history are deleted with it. This cannot be undone."
        footer={
          <>
            <Button variant="secondary" onClick={() => setDeleting(null)}>
              Cancel
            </Button>
            <Button variant="danger" loading={busy} onClick={confirmDelete}>
              Delete
            </Button>
          </>
        }
      >
        {deleting && (
          <dl className="sv-deflist">
            <dt>Order</dt>
            <dd>#{deleting.id.slice(0, 8)}</dd>
            <dt>Customer</dt>
            <dd>{deleting.email}</dd>
            <dt>Amount</dt>
            <dd>{money(deleting.total)}</dd>
          </dl>
        )}
      </Modal>
    </>
  );
}
