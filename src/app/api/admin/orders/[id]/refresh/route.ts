import { NextResponse, type NextRequest } from 'next/server';
import { SmmGen, SmmGenError } from '@/lib/smmgen';
import { createAdminClient } from '@/lib/supabase/admin';
import { requireAdmin } from '@/lib/auth';
import { aggregateStatus, classifyProviderError, mapProviderStatus, PROVIDER_ERROR_MESSAGE } from '@/lib/orders';
import type { OrderItem } from '@/lib/supabase/types';

export const dynamic = 'force-dynamic';

type Params = { params: Promise<{ id: string }> };

/** Interroge le fournisseur pour une commande précise (bouton admin). */
export async function POST(_request: NextRequest, { params }: Params) {
  const auth = await requireAdmin();
  if (!auth.ok) {
    return NextResponse.json(
      { error: auth.status === 401 ? 'Session expired' : 'Forbidden' },
      { status: auth.status }
    );
  }

  if (!process.env.SMMGEN_API_KEY) {
    return NextResponse.json({ error: 'SMMGEN_API_KEY is not configured.' }, { status: 400 });
  }

  const { id } = await params;
  const admin = createAdminClient();

  const { data: items } = await admin.from('order_items').select('*').eq('order_id', id);
  const lines = (items ?? []) as OrderItem[];
  const withProvider = lines.filter((l) => l.provider_order_id);

  if (withProvider.length === 0) {
    return NextResponse.json({ error: 'This order was never submitted to the provider.' }, { status: 400 });
  }

  const provider = new SmmGen();
  let statuses: Record<string, { status?: string; start_count?: string; remains?: string; error?: string }>;

  try {
    statuses = await provider.multiStatus(withProvider.map((l) => l.provider_order_id as number));
  } catch (e) {
    const raw = e instanceof SmmGenError ? e.message : String(e);
    return NextResponse.json({ error: PROVIDER_ERROR_MESSAGE[classifyProviderError(raw)] }, { status: 502 });
  }

  let updated = 0;
  for (const line of withProvider) {
    const result = statuses[String(line.provider_order_id)];
    if (!result || result.error) continue;

    const mapped = mapProviderStatus(result.status);
    if (!mapped) continue;

    await admin
      .from('order_items')
      .update({
        status: mapped,
        start_count: result.start_count ? Number(result.start_count) : line.start_count,
        remains: result.remains ? Number(result.remains) : line.remains,
        synced_at: new Date().toISOString(),
      })
      .eq('id', line.id);

    updated += 1;
  }

  const { data: refreshed } = await admin.from('order_items').select('status').eq('order_id', id);
  const next = aggregateStatus((refreshed ?? []).map((l) => l.status as string));

  const { data: current } = await admin.from('orders').select('status').eq('id', id).maybeSingle();
  if (current && current.status !== next) {
    await admin.from('orders').update({ status: next }).eq('id', id);
    await admin.from('order_events').insert({
      order_id: id,
      from_status: current.status,
      to_status: next,
      source: 'provider',
      actor_id: auth.user.id,
    });
  }

  return NextResponse.json({ ok: true, updated, status: next });
}
