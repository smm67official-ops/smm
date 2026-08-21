'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button, Card, CardBody, CardHeader, Icon, Select, Textarea, useToast } from '@/design-system';
import { ORDER_STATUSES, STATUS_LABEL } from '@/lib/orders';
import type { OrderStatus } from '@/lib/supabase/types';

export default function OrderStatusPanel({
  orderId,
  currentStatus,
}: {
  orderId: string;
  currentStatus: OrderStatus;
}) {
  const router = useRouter();
  const { toast } = useToast();

  const [status, setStatus] = useState<OrderStatus>(currentStatus);
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const save = async () => {
    setSaving(true);
    const response = await fetch(`/api/admin/orders/${orderId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status, note: note.trim() || undefined }),
    });

    const result = await response.json().catch(() => ({}));
    setSaving(false);

    if (!response.ok) {
      toast({ tone: 'error', title: 'Failed to update status', description: result.error });
      return;
    }

    toast({ tone: 'success', title: 'Status updated', description: STATUS_LABEL[status] });
    setNote('');
    router.refresh();
  };

  const refreshProvider = async () => {
    setRefreshing(true);
    const response = await fetch(`/api/admin/orders/${orderId}/refresh`, { method: 'POST' });
    const result = await response.json().catch(() => ({}));
    setRefreshing(false);

    if (!response.ok) {
      toast({ tone: 'error', title: 'Provider unavailable', description: result.error });
      return;
    }

    toast({
      tone: 'success',
      title: 'Provider status refreshed',
      description: `${result.updated} line(s) updated — order is ${result.status}`,
    });
    router.refresh();
  };

  return (
    <Card>
      <CardHeader title="Manage order" subtitle="Changes are recorded in the history" />
      <CardBody>
        <div className="sv-stack" style={{ gap: 'var(--sv-space-4)' }}>
          <Select
            label="Internal status"
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

          <Button block loading={saving} onClick={save} disabled={status === currentStatus && !note.trim()}>
            Save status
          </Button>

          <Button
            block
            variant="secondary"
            loading={refreshing}
            onClick={refreshProvider}
            leadingIcon={<Icon name="refresh" size={16} />}
          >
            Refresh provider status
          </Button>
        </div>
      </CardBody>
    </Card>
  );
}
