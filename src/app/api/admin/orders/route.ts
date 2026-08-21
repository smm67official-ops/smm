import { NextResponse, type NextRequest } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { requireAdmin } from '@/lib/auth';
import { priceFor, validateOrder } from '@/lib/smmgen';
import type { Service } from '@/lib/supabase/types';

export const dynamic = 'force-dynamic';

/**
 * Création d'une commande par un administrateur, pour le compte d'un client.
 * Le prix est toujours recalculé à partir du catalogue en base.
 */
export async function POST(request: NextRequest) {
  const auth = await requireAdmin();
  if (!auth.ok) {
    return NextResponse.json(
      { error: auth.status === 401 ? 'Session expired' : 'Forbidden' },
      { status: auth.status }
    );
  }

  let body: {
    email?: string;
    serviceId?: string;
    link?: string;
    quantity?: number;
    status?: string;
    note?: string;
  };

  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  if (!body.email || !body.serviceId) {
    return NextResponse.json({ error: 'Customer email and service are required' }, { status: 400 });
  }

  const admin = createAdminClient();

  const { data: service } = await admin
    .from('services')
    .select('*')
    .eq('id', body.serviceId)
    .maybeSingle();

  if (!service) return NextResponse.json({ error: 'Unknown service' }, { status: 400 });

  const typed = service as Service;
  const needsQuantity = typed.type !== 'Package';
  const quantity = needsQuantity ? Number(body.quantity ?? 0) : typed.min;

  if (needsQuantity && (quantity < typed.min || quantity > typed.max)) {
    return NextResponse.json(
      { error: `Quantity must be between ${typed.min} and ${typed.max}` },
      { status: 400 }
    );
  }

  if (typed.type !== 'Subscriptions' && !body.link?.trim()) {
    return NextResponse.json({ error: 'A target link is required' }, { status: 400 });
  }

  try {
    validateOrder(typed.type, {
      service: typed.provider_service_id,
      ...(body.link ? { link: body.link.trim() } : {}),
      ...(needsQuantity ? { quantity } : {}),
    });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 400 });
  }

  // Rattachement au compte client si l'e-mail correspond à un utilisateur.
  const { data: users } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 });
  const owner = users?.users.find((u) => u.email?.toLowerCase() === body.email!.toLowerCase());

  const charge = priceFor(typed.rate, quantity);

  const { data: order, error } = await admin
    .from('orders')
    .insert({
      user_id: owner?.id ?? null,
      status: (body.status as never) ?? 'pending',
      total: charge,
      email: body.email.trim(),
      note: body.note ?? 'Created from admin panel',
    })
    .select('id')
    .single();

  if (error || !order) {
    return NextResponse.json({ error: error?.message ?? 'Order creation failed' }, { status: 500 });
  }

  const { error: itemError } = await admin.from('order_items').insert({
    order_id: order.id,
    service_id: typed.id,
    provider_service_id: typed.provider_service_id,
    service_name: typed.name,
    link: body.link?.trim() ?? null,
    quantity,
    rate: typed.rate,
    charge,
    status: (body.status as string) ?? 'pending',
  });

  if (itemError) return NextResponse.json({ error: itemError.message }, { status: 500 });

  await admin.from('order_events').insert({
    order_id: order.id,
    to_status: (body.status as string) ?? 'pending',
    source: 'admin',
    actor_id: auth.user.id,
    note: 'Order created from admin panel',
  });

  return NextResponse.json({ ok: true, orderId: order.id, total: charge });
}
