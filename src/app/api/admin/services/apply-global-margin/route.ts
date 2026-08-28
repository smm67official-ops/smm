import { NextResponse, type NextRequest } from 'next/server';
import { requireAdmin } from '@/lib/auth';
import { createAdminClient } from '@/lib/supabase/admin';
import { MARGIN_MESSAGE, validateMargin } from '@/lib/pricing';
import { audit, clientIp } from '@/lib/audit';

export const dynamic = 'force-dynamic';

/**
 * Applique une marge à tout le catalogue.
 *
 * Tout le travail vit dans `apply_global_margin`, côté base : sur
 * plusieurs milliers de services, une boucle envoyée par lots depuis
 * ici peut s'interrompre au milieu et laisser la moitié du catalogue à
 * l'ancienne marge. La fonction s'exécute dans une transaction unique —
 * tout passe, ou rien.
 *
 * `reset_custom_margins` décide du sort des exceptions :
 *   true  → elles disparaissent, tout suit le global
 *   false → le global change, les exceptions sont conservées
 */
export async function POST(request: NextRequest) {
  const auth = await requireAdmin();
  if (!auth.ok) {
    return NextResponse.json(
      { error: auth.status === 401 ? 'Session expired' : 'Forbidden', code: 'UNAUTHORIZED' },
      { status: auth.status }
    );
  }

  let body: { margin?: unknown; reset_custom_margins?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const margin = validateMargin(body.margin);
  if (!margin.ok) {
    return NextResponse.json(
      { error: MARGIN_MESSAGE[margin.error], code: margin.error },
      { status: 400 }
    );
  }

  // Par défaut on réinitialise : c'est le sens attendu de « appliquer à
  // tous les services ». Conserver les exceptions doit être demandé.
  const reset = body.reset_custom_margins !== false;

  const admin = createAdminClient();
  const { data, error } = await admin.rpc('apply_global_margin', {
    p_margin: margin.margin,
    p_reset: reset,
    p_actor: auth.user.id,
  });

  if (error) {
    if (/Could not find the function|does not exist|schema cache/i.test(error.message)) {
      return NextResponse.json(
        { error: 'Margins need migration 011 — run it in the Supabase SQL editor.' },
        { status: 409 }
      );
    }
    if (error.message.includes('INVALID_MARGIN')) {
      return NextResponse.json({ error: MARGIN_MESSAGE.MARGIN_OUT_OF_RANGE }, { status: 400 });
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const result = Array.isArray(data) ? data[0] : data;
  const updated = Number(result?.updated_services ?? 0);
  const resetCount = Number(result?.reset_customs ?? 0);

  await audit({
    action: 'BALANCE_ADJUSTED',
    actorId: auth.user.id,
    targetType: 'services',
    amount: margin.margin,
    metadata: {
      operation: 'apply_global_margin',
      margin: margin.margin,
      reset_custom_margins: reset,
      updated_services: updated,
      reset_customs: resetCount,
    },
    ip: clientIp(request),
  });

  return NextResponse.json({
    ok: true,
    margin: margin.margin,
    updatedServices: updated,
    resetCustomMargins: resetCount,
  });
}
