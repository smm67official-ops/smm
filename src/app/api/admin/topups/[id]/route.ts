import { NextResponse, type NextRequest } from 'next/server';
import { requireAdmin } from '@/lib/auth';
import { settleTopUpRequest } from '@/lib/topup';

export const dynamic = 'force-dynamic';

/**
 * Approbation ou refus d'une demande de recharge.
 * L'approbation crédite le portefeuille par `wallet_apply` ; la double
 * approbation est bloquée en base (réservation par `reviewed_by`).
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAdmin();
  if (!auth.ok) {
    return NextResponse.json(
      { error: auth.status === 401 ? 'Session expired' : 'Forbidden' },
      { status: auth.status }
    );
  }

  const { id } = await params;

  let body: { decision?: string; note?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  if (body.decision !== 'approved' && body.decision !== 'rejected') {
    return NextResponse.json(
      { error: 'decision must be "approved" or "rejected"' },
      { status: 400 }
    );
  }

  const result = await settleTopUpRequest({
    id,
    decision: body.decision,
    actorId: auth.user.id,
    reviewNote: body.note?.trim() || null,
  });

  if (!result.ok) {
    const status = result.code === 'ALREADY_SETTLED' ? 409 : 500;
    const message =
      result.code === 'ALREADY_SETTLED'
        ? 'This request has already been handled.'
        : result.message;

    return NextResponse.json({ error: message, code: result.code }, { status });
  }

  return NextResponse.json({ ok: true, balance: result.balance });
}
