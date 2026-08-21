'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { Button, Icon, useToast } from '@/design-system';

/** Déclenche la synchronisation fournisseur sans exposer le secret au navigateur. */
export default function AdminSyncButton({
  target = 'sync',
  label = 'Sync catalogue',
}: {
  target?: 'sync' | 'status';
  label?: string;
}) {
  const router = useRouter();
  const { toast } = useToast();
  const [busy, setBusy] = useState(false);

  const run = async () => {
    setBusy(true);
    const response = await fetch(`/api/admin/sync?target=${target}`, { method: 'POST' });
    const result = await response.json().catch(() => ({}));
    setBusy(false);

    if (!response.ok) {
      toast({ tone: 'error', title: 'Provider unavailable', description: result.error });
      return;
    }

    toast({
      tone: 'success',
      title: target === 'sync' ? 'Catalogue synced' : 'Statuses refreshed',
      description:
        target === 'sync'
          ? `${result.services} services, ${result.categories} categories${result.skipped ? `, ${result.skipped} skipped` : ''}`
          : `${result.updated}/${result.checked} order line(s) updated`,
    });
    router.refresh();
  };

  return (
    <Button
      variant="secondary"
      loading={busy}
      onClick={run}
      leadingIcon={<Icon name="refresh" size={16} />}
    >
      {label}
    </Button>
  );
}
