import { NextResponse, type NextRequest } from 'next/server';
import { requireAdmin } from '@/lib/auth';
import { createAdminClient } from '@/lib/supabase/admin';
import { listWhatsAppNumbers } from '@/lib/settings';
import { messageFor, validateLabel, validateWhatsAppNumber } from '@/lib/settings-validation';

export const dynamic = 'force-dynamic';

/** Liste des numéros WhatsApp (back-office). */
export async function GET() {
  const auth = await requireAdmin();
  if (!auth.ok) {
    return NextResponse.json(
      { error: auth.status === 401 ? 'Session expired' : 'Forbidden' },
      { status: auth.status }
    );
  }

  return NextResponse.json({ numbers: await listWhatsAppNumbers() });
}

/**
 * Ajout d'un numéro.
 *
 * Le premier numéro enregistré devient actif d'office : sans cela le
 * panel resterait sans numéro tant qu'un second geste n'a pas été fait,
 * et les parcours WhatsApp disparaîtraient silencieusement.
 */
export async function POST(request: NextRequest) {
  const auth = await requireAdmin();
  if (!auth.ok) {
    return NextResponse.json(
      { error: auth.status === 401 ? 'Session expired' : 'Forbidden' },
      { status: auth.status }
    );
  }

  let body: { label?: string; number?: string; note?: string; activate?: boolean };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const label = validateLabel(body.label);
  if (!label.ok) return NextResponse.json({ error: messageFor(label.error) }, { status: 400 });

  const number = validateWhatsAppNumber(body.number);
  if (!number.ok) return NextResponse.json({ error: messageFor(number.error) }, { status: 400 });

  const admin = createAdminClient();

  const { data: existing } = await admin
    .from('whatsapp_numbers')
    .select('id')
    .eq('number', number.value)
    .maybeSingle();

  if (existing) {
    return NextResponse.json({ error: messageFor('DUPLICATE_NUMBER') }, { status: 409 });
  }

  const { count } = await admin
    .from('whatsapp_numbers')
    .select('id', { count: 'exact', head: true });

  const first = (count ?? 0) === 0;

  const { data, error } = await admin
    .from('whatsapp_numbers')
    .insert({
      label: label.value,
      number: number.value,
      note: body.note?.trim() || null,
      // L'activation explicite passe par la fonction dédiée, plus bas :
      // insérer `is_active = true` directement heurterait l'index unique
      // s'il existe déjà un actif.
      is_active: first,
    })
    .select('*')
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  if (body.activate && !first) {
    const { error: activateError } = await admin.rpc('activate_whatsapp_number', {
      p_id: data.id,
    });
    if (activateError) {
      return NextResponse.json({ error: activateError.message }, { status: 400 });
    }
  }

  return NextResponse.json({ number: data }, { status: 201 });
}
