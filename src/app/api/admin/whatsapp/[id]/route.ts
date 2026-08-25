import { NextResponse, type NextRequest } from 'next/server';
import { requireAdmin } from '@/lib/auth';
import { createAdminClient } from '@/lib/supabase/admin';
import { messageFor, validateLabel, validateWhatsAppNumber } from '@/lib/settings-validation';
import type { WhatsAppNumber } from '@/lib/supabase/types';

export const dynamic = 'force-dynamic';

const guard = async () => {
  const auth = await requireAdmin();
  if (auth.ok) return null;
  return NextResponse.json(
    { error: auth.status === 401 ? 'Session expired' : 'Forbidden' },
    { status: auth.status }
  );
};

/**
 * Modification d'un numéro, ou activation.
 *
 * `{ activate: true }` passe par `activate_whatsapp_number` : la bascule
 * doit être atomique, sinon l'index unique « un seul actif » rejette
 * l'opération dès que deux écritures se croisent.
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const denied = await guard();
  if (denied) return denied;

  const { id } = await params;
  const admin = createAdminClient();

  let body: { label?: string; number?: string; note?: string; activate?: boolean };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  if (body.activate) {
    const { data, error } = await admin.rpc('activate_whatsapp_number', { p_id: id });
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    return NextResponse.json({ number: data });
  }

  const patch: Partial<Pick<WhatsAppNumber, 'label' | 'number' | 'note'>> = {};

  if (body.label !== undefined) {
    const label = validateLabel(body.label);
    if (!label.ok) return NextResponse.json({ error: messageFor(label.error) }, { status: 400 });
    patch.label = label.value;
  }

  if (body.number !== undefined) {
    const number = validateWhatsAppNumber(body.number);
    if (!number.ok) return NextResponse.json({ error: messageFor(number.error) }, { status: 400 });

    const { data: clash } = await admin
      .from('whatsapp_numbers')
      .select('id')
      .eq('number', number.value)
      .neq('id', id)
      .maybeSingle();

    if (clash) {
      return NextResponse.json({ error: messageFor('DUPLICATE_NUMBER') }, { status: 409 });
    }

    patch.number = number.value;
  }

  if (body.note !== undefined) patch.note = body.note?.trim() || null;

  if (Object.keys(patch).length === 0) {
    return NextResponse.json({ error: 'Nothing to update' }, { status: 400 });
  }

  const { data, error } = await admin
    .from('whatsapp_numbers')
    .update(patch)
    .eq('id', id)
    .select('*')
    .maybeSingle();

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  if (!data) return NextResponse.json({ error: 'Number not found' }, { status: 404 });

  return NextResponse.json({ number: data });
}

/**
 * Suppression.
 *
 * Le numéro actif ne peut pas être supprimé : le panel se retrouverait
 * sans aucun contact WhatsApp, et l'étape de recharge disparaîtrait sans
 * que personne ne s'en aperçoive. Il faut d'abord en activer un autre.
 */
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const denied = await guard();
  if (denied) return denied;

  const { id } = await params;
  const admin = createAdminClient();

  const { data: target } = await admin
    .from('whatsapp_numbers')
    .select('is_active')
    .eq('id', id)
    .maybeSingle();

  if (!target) return NextResponse.json({ error: 'Number not found' }, { status: 404 });

  if (target.is_active) {
    return NextResponse.json(
      { error: 'Activate another number before deleting the active one.' },
      { status: 409 }
    );
  }

  const { error } = await admin.from('whatsapp_numbers').delete().eq('id', id);
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  return NextResponse.json({ ok: true });
}
