import { NextResponse, type NextRequest } from 'next/server';
import { SmmGen, SmmGenError } from '@/lib/smmgen';
import { createAdminClient } from '@/lib/supabase/admin';
import { aggregateStatus, mapProviderStatus } from '@/lib/orders';
import type { OrderItem } from '@/lib/supabase/types';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

/**
 * Synchronisation des statuts fournisseur.
 *
 *   curl -X POST http://localhost:3000/api/smm/status -H "x-sync-secret: $SMM_SYNC_SECRET"
 *
 * À planifier toutes les 5–10 minutes (SMMGenAPIReference.md §10.7 :
 * interroger en lot de 100, jamais à chaque affichage de page).
 */
export async function POST(request: NextRequest) {
  const secret = process.env.SMM_SYNC_SECRET;
  if (!secret || request.headers.get('x-sync-secret') !== secret) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  if (!process.env.SMMGEN_API_KEY) {
    return NextResponse.json({ error: 'SMMGEN_API_KEY is not set' }, { status: 400 });
  }

  const admin = createAdminClient();

  // Lignes encore en cours, avec un identifiant fournisseur.
  const { data: items, error } = await admin
    .from('order_items')
    .select('*')
    .not('provider_order_id', 'is', null)
    .not('status', 'in', '("completed","canceled","refunded")')
    .limit(100);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const pending = (items ?? []) as OrderItem[];
  if (pending.length === 0) return NextResponse.json({ ok: true, checked: 0, updated: 0 });

  const provider = new SmmGen();
  let statuses: Record<string, { status?: string; start_count?: string; remains?: string; error?: string }>;

  try {
    statuses = await provider.multiStatus(pending.map((i) => i.provider_order_id as number));
  } catch (e) {
    const message = e instanceof SmmGenError ? e.message : String(e);
    return NextResponse.json({ error: message }, { status: 502 });
  }

  let updated = 0;
  const touchedOrders = new Set<string>();

  for (const item of pending) {
    const result = statuses[String(item.provider_order_id)];
    if (!result || result.error) continue;

    const mapped = mapProviderStatus(result.status);
    if (!mapped) continue;

    await admin
      .from('order_items')
      .update({
        status: mapped,
        start_count: result.start_count ? Number(result.start_count) : item.start_count,
        remains: result.remains ? Number(result.remains) : item.remains,
        synced_at: new Date().toISOString(),
      })
      .eq('id', item.id);

    updated += 1;
    touchedOrders.add(item.order_id);
  }

  // Recalcul du statut global de chaque commande touchée.
  for (const orderId of touchedOrders) {
    const { data: lines } = await admin.from('order_items').select('status').eq('order_id', orderId);
    const next = aggregateStatus((lines ?? []).map((l) => l.status as string));

    const { data: current } = await admin.from('orders').select('status').eq('id', orderId).maybeSingle();
    if (current && current.status !== next) {
      await admin.from('orders').update({ status: next }).eq('id', orderId);
      await admin.from('order_events').insert({
        order_id: orderId,
        from_status: current.status,
        to_status: next,
        source: 'provider',
      });
    }
  }

  return NextResponse.json({ ok: true, checked: pending.length, updated, orders: touchedOrders.size });
}
