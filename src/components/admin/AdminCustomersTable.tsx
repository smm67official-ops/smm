'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import {
  Avatar,
  Button,
  Dropdown,
  Icon,
  Input,
  Modal,
  Select,
  useToast,
  Textarea,
} from '@/design-system';
import WalletModal from '@/components/admin/WalletModal';
import BalanceModal from '@/components/admin/BalanceModal';
import type { Profile } from '@/lib/supabase/types';

export type CustomerRow = Profile & { orders: number; spent: number };

const money = (value: number) => `$${Number(value ?? 0).toFixed(2)}`;

const ROLE_OPTIONS = [
  { value: 'customer', label: 'Customer' },
  { value: 'support', label: 'Support' },
  { value: 'admin', label: 'Admin' },
];

const emptyForm = {
  email: '',
  password: '',
  username: '',
  full_name: '',
  phone: '',
  role: 'customer',
  balance: 0,
};

export default function AdminCustomersTable({
  locale,
  customers,
  currentUserId,
}: {
  locale: string;
  customers: CustomerRow[];
  currentUserId: string;
}) {
  const router = useRouter();
  const { toast } = useToast();

  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<CustomerRow | null>(null);
  const [deleting, setDeleting] = useState<CustomerRow | null>(null);
  const [wallet, setWallet] = useState<CustomerRow | null>(null);
  const [balance, setBalance] = useState<CustomerRow | null>(null);
  const [blocking, setBlocking] = useState<CustomerRow | null>(null);
  const [blockReason, setBlockReason] = useState('');
  const [form, setForm] = useState({ ...emptyForm });
  const [busy, setBusy] = useState(false);

  const set = (key: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setForm((f) => ({ ...f, [key]: e.target.value }));

  const openCreate = () => {
    setForm({ ...emptyForm });
    setCreating(true);
  };

  const openEdit = (customer: CustomerRow) => {
    setForm({
      email: '',
      password: '',
      username: customer.username ?? '',
      full_name: customer.full_name ?? '',
      phone: customer.phone ?? '',
      role: customer.role,
      balance: Number(customer.balance),
    });
    setEditing(customer);
  };

  const create = async () => {
    setBusy(true);
    const response = await fetch('/api/admin/users', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    });
    const result = await response.json().catch(() => ({}));
    setBusy(false);

    if (!response.ok) {
      toast({ tone: 'error', title: 'User not created', description: result.error });
      return;
    }

    toast({ tone: 'success', title: 'User created', description: form.email });
    setCreating(false);
    router.refresh();
  };

  const save = async () => {
    if (!editing) return;
    setBusy(true);

    // `balance` est volontairement absent : le solde ne se modifie que
    // par un mouvement de portefeuille, pour garder l'audit complet.
    const payload: Record<string, unknown> = {
      username: form.username,
      full_name: form.full_name,
      phone: form.phone,
    };
    if (form.role !== editing.role) payload.role = form.role;
    if (form.password) payload.password = form.password;

    const response = await fetch(`/api/admin/users/${editing.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const result = await response.json().catch(() => ({}));
    setBusy(false);

    if (!response.ok) {
      toast({ tone: 'error', title: 'Update failed', description: result.error });
      return;
    }

    toast({ tone: 'success', title: 'Customer updated' });
    setEditing(null);
    router.refresh();
  };

  const confirmDelete = async () => {
    if (!deleting) return;
    setBusy(true);

    const response = await fetch(`/api/admin/users/${deleting.id}`, { method: 'DELETE' });
    const result = await response.json().catch(() => ({}));
    setBusy(false);

    if (!response.ok) {
      toast({ tone: 'error', title: 'Delete failed', description: result.error });
      return;
    }

    toast({ tone: 'success', title: 'Account deleted' });
    setDeleting(null);
    router.refresh();
  };

  return (
    <>
      <div
        style={{
          display: 'flex',
          justifyContent: 'flex-end',
          padding: '14px 20px 0',
        }}
      >
        <button type="button" className="gp-btn gp-btn--primary gp-btn--sm" onClick={openCreate}>
          <Icon name="plus" size={14} />
          New user
        </button>
      </div>

      <div className="gp-table-wrap">
        <table className="gp-table rs-table">
          <thead>
            <tr>
              <th>Customer</th>
              <th>Role</th>
              <th>Status</th>
              <th className="gp-table__num">Orders</th>
              <th className="gp-table__num">Spent</th>
              <th className="gp-table__num">Balance</th>
              <th>Joined</th>
              <th className="gp-table__num">Actions</th>
            </tr>
          </thead>
          <tbody>
            {customers.map((customer) => (
              <tr key={customer.id}>
                <td data-label="Customer" className="rs-cell--head">
                  <span className="gp-cell-stack">
                    <Avatar name={customer.full_name ?? customer.username ?? '?'} size="sm" />
                    <span style={{ minWidth: 0 }}>
                      <span className="gp-table__strong" style={{ display: 'block' }}>
                        {customer.full_name || customer.username || '—'}
                      </span>
                      <span className="gp-table__muted">{customer.id.slice(0, 8)}</span>
                    </span>
                  </span>
                </td>
                <td data-label="Role">
                  <span
                    className={`gp-pill ${customer.role === 'customer' ? 'gp-pill--neutral' : 'gp-pill--brand'}`}
                  >
                    <span className="gp-pill__dot" />
                    {customer.role}
                  </span>
                </td>
                <td data-label="Status">
                  <span
                    className={`gp-pill ${customer.is_blocked ? 'gp-pill--danger' : 'gp-pill--success'}`}
                  >
                    <span className="gp-pill__dot" />
                    {customer.is_blocked ? 'Blocked' : 'Active'}
                  </span>
                </td>
                <td className="gp-table__num" data-label="Orders">{customer.orders}</td>
                <td className="gp-table__num gp-table__strong" data-label="Spent">{money(customer.spent)}</td>
                <td className="gp-table__num gp-table__strong" data-label="Balance" style={{ color: 'var(--gp-brand-ink)' }}>{money(customer.balance)}</td>
                <td className="gp-table__muted" data-label="Joined">
                  {new Date(customer.created_at).toLocaleDateString('en-GB', { dateStyle: 'medium' })}
                </td>
                <td data-label="">
                  <div className="gp-table__actions">
                    <button
                      type="button"
                      className="gp-btn gp-btn--sm gp-btn--primary"
                      onClick={() => setBalance(customer)}
                    >
                      <Icon name="card" size={13} />
                      Balance
                    </button>
                    <Link
                      href={`/${locale}/admin/orders?q=${encodeURIComponent(customer.username ?? '')}`}
                      className="gp-btn gp-btn--sm"
                    >
                      Orders
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
                        {
                          type: 'item',
                          id: 'wallet',
                          label: 'Manage wallet',
                          icon: <Icon name="wallet" size={14} />,
                          onSelect: () => setWallet(customer),
                        },
                        {
                          type: 'item',
                          id: 'block',
                          label: customer.is_blocked ? 'Unblock user' : 'Block user',
                          icon: <Icon name="lock" size={14} />,
                          onSelect: () => {
                            setBlockReason('');
                            setBlocking(customer);
                          },
                        },
                        {
                          type: 'item',
                          id: 'edit',
                          label: 'Edit customer',
                          icon: <Icon name="refresh" size={14} />,
                          onSelect: () => openEdit(customer),
                        },
                        { type: 'divider', id: 'd' },
                        {
                          type: 'item',
                          id: 'delete',
                          label: customer.id === currentUserId ? 'Cannot delete yourself' : 'Delete account',
                          danger: true,
                          icon: <Icon name="trash" size={14} />,
                          onSelect: () => customer.id !== currentUserId && setDeleting(customer),
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

      <BalanceModal
        open={Boolean(balance)}
        onClose={() => setBalance(null)}
        customer={
          balance
            ? {
                id: balance.id,
                name: balance.full_name || balance.username || balance.id.slice(0, 8),
                balance: Number(balance.balance),
              }
            : null
        }
      />

      {/* Blocage : confirmation explicite, avec motif consigné au journal. */}
      <Modal
        open={Boolean(blocking)}
        onClose={() => setBlocking(null)}
        title={blocking?.is_blocked ? 'Unblock user' : 'Block user'}
        description={blocking?.full_name || blocking?.username || undefined}
        footer={
          <>
            <Button variant="ghost" onClick={() => setBlocking(null)}>
              Cancel
            </Button>
            <Button
              loading={busy}
              onClick={async () => {
                if (!blocking) return;
                setBusy(true);

                const response = await fetch(`/api/admin/users/${blocking.id}/block`, {
                  method: 'PATCH',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ blocked: !blocking.is_blocked, reason: blockReason }),
                });
                const result = await response.json().catch(() => ({}));
                setBusy(false);

                if (!response.ok) {
                  toast({ tone: 'error', title: 'Could not update', description: result.error });
                  return;
                }

                toast({
                  tone: 'success',
                  title: blocking.is_blocked ? 'User unblocked' : 'User blocked',
                });
                setBlocking(null);
                router.refresh();
              }}
            >
              {blocking?.is_blocked ? 'Unblock' : 'Block'}
            </Button>
          </>
        }
      >
        <div className="sv-stack" style={{ gap: 'var(--sv-space-3)' }}>
          <p className="gp-card-head__desc" style={{ margin: 0 }}>
            {blocking?.is_blocked
              ? 'The account will be able to sign in and order again.'
              : 'The account will be signed out and refused at login. Orders and top-ups are blocked by the database, not only by the interface.'}
          </p>

          {!blocking?.is_blocked && (
            <Textarea
              label="Reason"
              optional
              rows={2}
              value={blockReason}
              onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setBlockReason(e.target.value)}
              hint="Recorded in the audit trail."
            />
          )}
        </div>
      </Modal>

      <WalletModal
        open={Boolean(wallet)}
        onClose={() => setWallet(null)}
        customer={
          wallet
            ? {
                id: wallet.id,
                name: wallet.full_name || wallet.username || wallet.id.slice(0, 8),
                balance: Number(wallet.balance),
              }
            : null
        }
      />

      {/* Création */}
      <Modal
        open={creating}
        onClose={() => setCreating(false)}
        title="Create a user"
        description="The email is confirmed automatically — the user can sign in right away."
        footer={
          <>
            <Button variant="secondary" onClick={() => setCreating(false)}>
              Cancel
            </Button>
            <Button loading={busy} onClick={create} disabled={!form.email || form.password.length < 6}>
              Create user
            </Button>
          </>
        }
      >
        <div className="sv-stack" style={{ gap: 'var(--sv-space-4)' }}>
          <Input label="Email" type="email" value={form.email} onChange={set('email')} />
          <Input
            label="Password"
            type="password"
            hint="At least 6 characters"
            value={form.password}
            onChange={set('password')}
          />
          <Input label="Username" value={form.username} onChange={set('username')} />
          <Input label="Full name" value={form.full_name} onChange={set('full_name')} />
          <Select label="Role" value={form.role} onChange={set('role')} options={ROLE_OPTIONS} />
        </div>
      </Modal>

      {/* Édition */}
      <Modal
        open={Boolean(editing)}
        onClose={() => setEditing(null)}
        title="Edit customer"
        description={editing?.id}
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
          <Input label="Username" value={form.username} onChange={set('username')} />
          <Input label="Full name" value={form.full_name} onChange={set('full_name')} />
          <Input label="Phone" value={form.phone} onChange={set('phone')} />
          <Input
            label="Balance"
            value={money(Number(form.balance))}
            readOnly
            hint="Use the Wallet action to credit, debit or adjust — every movement is logged."
          />
          <Select
            label="Role"
            value={form.role}
            onChange={set('role')}
            options={ROLE_OPTIONS}
            hint={editing?.id === currentUserId ? 'You cannot change your own role.' : undefined}
            disabled={editing?.id === currentUserId}
          />
          <Input
            label="New password"
            type="password"
            placeholder="Leave empty to keep the current one"
            value={form.password}
            onChange={set('password')}
          />
        </div>
      </Modal>

      {/* Suppression */}
      <Modal
        open={Boolean(deleting)}
        onClose={() => setDeleting(null)}
        size="sm"
        title="Delete this account?"
        description="The profile and wishlist are removed. Past orders are kept but detached."
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
            <dt>Name</dt>
            <dd>{deleting.full_name || deleting.username || '—'}</dd>
            <dt>Orders</dt>
            <dd>{deleting.orders}</dd>
            <dt>Spent</dt>
            <dd>{money(deleting.spent)}</dd>
          </dl>
        )}
      </Modal>
    </>
  );
}
