import { NextResponse, type NextRequest } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { getSessionUser, isAdminRole } from '@/lib/auth';

export const dynamic = 'force-dynamic';

type Params = { params: Promise<{ id: string }> };

/**
 * Trace le clic sur « Compléter sur WhatsApp ».
 *
 * Cette route n'écrit QUE l'événement : elle ne crée aucune commande,
 * ne débite ni ne recrédite le portefeuille, et ne change pas le statut.
 */
export async function POST(_request: NextRequest, { params }: Params) {
  const { id } = await params;
  const user = await getSessionUser();

  if (!user) return NextResponse.json({ error: 'Session expired' }, { status: 401 });

  // Vérification de propriété via la session (RLS) : un client ne peut
  // journaliser que sur ses propres commandes ; un admin sur toutes.
  const supabase = await createClient();
  let query = supabase.from('orders').select('id, status').eq('id', id);
  if (!isAdminRole(user.role)) query = query.eq('user_id', user.id);

  const { data: order } = await query.maybeSingle();
  if (!order) return NextResponse.json({ error: 'Order not found' }, { status: 404 });

  const admin = createAdminClient();
  const { error } = await admin.from('order_events').insert({
    order_id: id,
    from_status: order.status,
    to_status: order.status, // aucun changement de statut
    event_type: 'WHATSAPP_CLICKED',
    source: 'whatsapp',
    actor_id: user.id,
    note: isAdminRole(user.role) ? 'Admin opened WhatsApp' : 'Customer opened WhatsApp',
  });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true });
}
