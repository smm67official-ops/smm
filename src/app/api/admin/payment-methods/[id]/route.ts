import { NextResponse, type NextRequest } from 'next/server';
import { requireAdmin } from '@/lib/auth';
import { createAdminClient } from '@/lib/supabase/admin';
import { deletePaymentIcon, uploadPaymentIcon } from '@/lib/storage';
import { messageFor } from '@/lib/settings-validation';
import { readMethodFields } from '@/lib/payment-method-form';

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
 * Mise à jour d'un moyen de paiement.
 *
 * Deux formes acceptées :
 *  - `application/json` avec `{ is_active }` pour la simple bascule, qui
 *    n'a pas besoin de transporter tout le formulaire ;
 *  - `multipart/form-data` pour une modification complète, icône incluse.
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const denied = await guard();
  if (denied) return denied;

  const { id } = await params;
  const admin = createAdminClient();

  const { data: current } = await admin
    .from('payment_methods')
    .select('*')
    .eq('id', id)
    .maybeSingle();

  if (!current) return NextResponse.json({ error: 'Payment method not found' }, { status: 404 });

  // --- Bascule seule -------------------------------------------------
  if (request.headers.get('content-type')?.includes('application/json')) {
    const body = (await request.json().catch(() => ({}))) as { is_active?: boolean };

    if (typeof body.is_active !== 'boolean') {
      return NextResponse.json({ error: 'is_active must be a boolean' }, { status: 400 });
    }

    const { data, error } = await admin
      .from('payment_methods')
      .update({ is_active: body.is_active })
      .eq('id', id)
      .select('*')
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    return NextResponse.json({ method: data });
  }

  // --- Modification complète -----------------------------------------
  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return NextResponse.json({ error: 'Expected multipart/form-data' }, { status: 400 });
  }

  const parsed = readMethodFields(form);
  if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400 });

  let iconUrl = current.icon_url;
  const icon = form.get('icon');
  const removeIcon = form.get('remove_icon') === 'true';

  if (icon instanceof File && icon.size > 0) {
    const upload = await uploadPaymentIcon(icon);
    if (!upload.ok) return NextResponse.json({ error: messageFor(upload.error) }, { status: 400 });

    // L'ancienne n'est retirée qu'une fois la nouvelle en place : en cas
    // d'échec du dépôt, le moyen de paiement garde une icône valide.
    await deletePaymentIcon(current.icon_url);
    iconUrl = upload.url;
  } else if (removeIcon) {
    await deletePaymentIcon(current.icon_url);
    iconUrl = null;
  }

  const { data, error } = await admin
    .from('payment_methods')
    .update({ ...parsed.fields, icon_url: iconUrl })
    .eq('id', id)
    .select('*')
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  return NextResponse.json({ method: data });
}

/** Suppression définitive, icône comprise. */
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const denied = await guard();
  if (denied) return denied;

  const { id } = await params;
  const admin = createAdminClient();

  const { data: current } = await admin
    .from('payment_methods')
    .select('icon_url')
    .eq('id', id)
    .maybeSingle();

  if (!current) return NextResponse.json({ error: 'Payment method not found' }, { status: 404 });

  const { error } = await admin.from('payment_methods').delete().eq('id', id);
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  await deletePaymentIcon(current.icon_url);

  return NextResponse.json({ ok: true });
}
