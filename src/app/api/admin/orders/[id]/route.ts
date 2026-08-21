import { NextResponse, type NextRequest } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { requireAdmin } from '@/lib/auth';
import { ORDER_STATUSES } from '@/lib/orders';
import type { OrderStatus } from '@/lib/supabase/types';

export const dynamic = 'force-dynamic';

type Params = { params: Promise<{ id: string }> };

/** Changement de statut par un administrateur, tracé dans order_events. */
export async function PATCH(request: NextRequest, { params }: Params) {
  const auth = await requireAdmin();
  if (!auth.ok) {
    return NextResponse.json(
      { error: auth.status === 401 ? 'Session expired' : 'Forbidden' },
      { status: auth.status }
    );
  }

  const { id } = await params;

  let body: { status?: string; note?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const status = body.status as OrderStatus | undefined;
  if (!status || !ORDER_STATUSES.includes(status)) {
    return NextResponse.json({ error: `Unknown status: ${body.status}` }, { status: 400 });
  }

  const admin = createAdminClient();

  const { data: current, error: readError } = await admin
    .from('orders')
    .select('status')
    .eq('id', id)
    .maybeSingle();

  if (readError) return NextResponse.json({ error: readError.message }, { status: 500 });
  if (!current) return NextResponse.json({ error: 'Order not found' }, { status: 404 });

  const { error: updateError } = await admin.from('orders').update({ status }).eq('id', id);
  if (updateError) return NextResponse.json({ error: updateError.message }, { status: 500 });

  await admin.from('order_events').insert({
    order_id: id,
    from_status: current.status,
    to_status: status,
    source: 'admin',
    actor_id: auth.user.id,
    note: body.note ?? null,
  });

  return NextResponse.json({ ok: true, status });
}

/** Suppression définitive d'une commande (lignes et journal en cascade). */
export async function DELETE(_request: NextRequest, { params }: Params) {
  const auth = await requireAdmin();
  if (!auth.ok) {
    return NextResponse.json(
      { error: auth.status === 401 ? 'Session expired' : 'Forbidden' },
      { status: auth.status }
    );
  }

  const { id } = await params;
  const admin = createAdminClient();

  const { error } = await admin.from('orders').delete().eq('id', id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true });
}
