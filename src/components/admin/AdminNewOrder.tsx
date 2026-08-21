'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import { Button, Icon, Input, Modal, Select, useToast } from '@/design-system';
import { createClient } from '@/lib/supabase/client';
import type { Service } from '@/lib/supabase/types';

/** Création d'une commande pour un client, depuis le back-office. */
export default function AdminNewOrder() {
  const router = useRouter();
  const { toast } = useToast();

  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [search, setSearch] = useState('');
  const [services, setServices] = useState<Service[]>([]);
  const [form, setForm] = useState({ email: '', serviceId: '', link: '', quantity: 0 });

  // Recherche de service à la volée (catalogue en lecture publique).
  useEffect(() => {
    if (!open) return;
    const timer = setTimeout(async () => {
      const supabase = createClient();
      let query = supabase.from('services').select('*').eq('is_active', true).limit(25);
      if (search.trim()) query = query.ilike('name', `%${search.trim()}%`);

      const { data } = await query;
      setServices((data ?? []) as Service[]);
    }, 300);

    return () => clearTimeout(timer);
  }, [search, open]);

  const selected = useMemo(
    () => services.find((s) => s.id === form.serviceId),
    [services, form.serviceId]
  );

  const charge = selected ? (selected.rate * form.quantity) / 1000 : 0;

  const submit = async () => {
    setBusy(true);
    const response = await fetch('/api/admin/orders', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    });

    const result = await response.json().catch(() => ({}));
    setBusy(false);

    if (!response.ok) {
      toast({ tone: 'error', title: 'Order not created', description: result.error });
      return;
    }

    toast({ tone: 'success', title: 'Order created', description: `#${result.orderId.slice(0, 8)}` });
    setOpen(false);
    setForm({ email: '', serviceId: '', link: '', quantity: 0 });
    router.refresh();
  };

  return (
    <>
      <Button onClick={() => setOpen(true)} leadingIcon={<Icon name="plus" size={16} />}>
        New order
      </Button>

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        size="lg"
        title="Create an order"
        description="The price is recalculated server-side from the catalogue."
        footer={
          <>
            <Button variant="secondary" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button
              loading={busy}
              onClick={submit}
              disabled={!form.email || !form.serviceId || (!!selected && selected.type !== 'Package' && !form.quantity)}
            >
              Create order
            </Button>
          </>
        }
      >
        <div className="sv-stack" style={{ gap: 'var(--sv-space-4)' }}>
          <Input
            label="Customer email"
            type="email"
            placeholder="customer@example.com"
            value={form.email}
            onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
            hint="If the email matches an account, the order is attached to it."
          />

          <Input
            label="Find a service"
            placeholder="Instagram followers…"
            icon={<Icon name="search" size={16} />}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />

          <Select
            label="Service"
            value={form.serviceId}
            placeholder={services.length ? 'Select a service' : 'No service — sync the catalogue first'}
            onChange={(e) => {
              const service = services.find((s) => s.id === e.target.value);
              setForm((f) => ({ ...f, serviceId: e.target.value, quantity: service?.min ?? 0 }));
            }}
            options={services.map((s) => ({
              value: s.id,
              label: `#${s.provider_service_id} — ${s.name.slice(0, 70)}`,
            }))}
          />

          {selected && (
            <>
              <Input
                label="Target link"
                type="url"
                placeholder="https://instagram.com/account"
                value={form.link}
                onChange={(e) => setForm((f) => ({ ...f, link: e.target.value }))}
              />
              <Input
                label={`Quantity (${selected.min.toLocaleString()} – ${selected.max.toLocaleString()})`}
                type="number"
                min={selected.min}
                max={selected.max}
                value={form.quantity}
                onChange={(e) => setForm((f) => ({ ...f, quantity: Number(e.target.value) || 0 }))}
              />
              <div className="sv-ordercharge">
                <span>Total charged</span>
                <b>${charge.toFixed(4)}</b>
              </div>
            </>
          )}
        </div>
      </Modal>
    </>
  );
}
