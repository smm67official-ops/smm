import { NextResponse, type NextRequest } from 'next/server';
import { requireAdmin } from '@/lib/auth';
import { createAdminClient } from '@/lib/supabase/admin';
import { audit, clientIp } from '@/lib/audit';

export const dynamic = 'force-dynamic';

/**
 * Blocage / déblocage d'un compte.
 *
 * Le drapeau vit sur le profil, et c'est la base qui l'applique : les
 * politiques d'insertion des commandes et des recharges portent
 * `not is_blocked()`. Un contrôle purement applicatif se contournerait
 * avec un jeton valide et une requête forgée.
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAdmin();
  if (!auth.ok) {
    return NextResponse.json(
      { error: auth.status === 401 ? 'Session expired' : 'Forbidden', code: 'UNAUTHORIZED' },
      { status: auth.status }
    );
  }

  const { id } = await params;

  let body: { blocked?: boolean; reason?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  if (typeof body.blocked !== 'boolean') {
    return NextResponse.json({ error: 'blocked must be a boolean' }, { status: 400 });
  }

  // Se bloquer soi-même coûterait l'accès au back-office, sans autre
  // administrateur garanti pour revenir en arrière.
  if (id === auth.user.id) {
    return NextResponse.json(
      { error: 'You cannot block your own account.' },
      { status: 409 }
    );
  }

  const admin = createAdminClient();

  const { data, error } = await admin
    .from('profiles')
    .update({
      is_blocked: body.blocked,
      blocked_at: body.blocked ? new Date().toISOString() : null,
      blocked_by: body.blocked ? auth.user.id : null,
      block_reason: body.blocked ? (body.reason?.trim() || null) : null,
    })
    .eq('id', id)
    .select('id, username, is_blocked')
    .maybeSingle();

  if (error) {
    if (/column .*is_blocked.* does not exist|schema cache/i.test(error.message)) {
      return NextResponse.json(
        { error: 'Blocking needs migration 009 — run it in the Supabase SQL editor.' },
        { status: 409 }
      );
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  if (!data) return NextResponse.json({ error: 'Unknown customer.' }, { status: 404 });

  await audit({
    action: body.blocked ? 'USER_BLOCKED' : 'USER_UNBLOCKED',
    actorId: auth.user.id,
    targetId: id,
    targetType: 'profile',
    metadata: { reason: body.reason?.trim() || null, username: data.username },
    ip: clientIp(request),
  });

  return NextResponse.json({ ok: true, profile: data });
}
