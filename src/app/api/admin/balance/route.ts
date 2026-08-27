import { NextResponse, type NextRequest } from 'next/server';
import { requireAdmin } from '@/lib/auth';
import { allocateBalance, reclaimBalance, totalAllocated, BALANCE_MESSAGE } from '@/lib/balance';
import { providerBalanceStatus } from '@/lib/provider-balance';
import { clientIp } from '@/lib/audit';

export const dynamic = 'force-dynamic';

const guard = async () => {
  const auth = await requireAdmin();
  if (auth.ok) return { auth, denied: null as null };
  return {
    auth: null,
    denied: NextResponse.json(
      { error: auth.status === 401 ? 'Session expired' : 'Forbidden', code: 'UNAUTHORIZED' },
      { status: auth.status }
    ),
  };
};

/**
 * État courant : solde fournisseur, engagé, disponible.
 * Alimente la boîte de dialogue avant confirmation — l'administrateur
 * voit ce qu'il reste avant de décider.
 */
export async function GET() {
  const { auth, denied } = await guard();
  if (denied || !auth) return denied;

  const [provider, allocated] = await Promise.all([providerBalanceStatus(), totalAllocated()]);

  return NextResponse.json({
    provider,
    allocated,
    available: provider.balance === null ? null : provider.balance - allocated,
  });
}

/**
 * Allocation ou reprise de solde.
 *
 * Le montant n'est jamais pris pour argent comptant : il est renormalisé
 * ici, et les contrôles décisifs (disponible fournisseur, solde client)
 * sont appliqués en base, dans la transaction qui écrit.
 */
export async function POST(request: NextRequest) {
  const { auth, denied } = await guard();
  if (denied || !auth) return denied;

  let body: { userId?: string; amount?: number; operation?: string; reason?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body', code: 'INVALID_AMOUNT' }, { status: 400 });
  }

  if (!body.userId) {
    return NextResponse.json({ error: 'A customer is required.', code: 'UNKNOWN_WALLET' }, { status: 400 });
  }

  const operation = body.operation === 'reclaim' ? 'reclaim' : 'allocate';

  if (!body.reason?.trim()) {
    return NextResponse.json(
      { error: 'A reason is required for the audit trail.', code: 'INVALID_AMOUNT' },
      { status: 400 }
    );
  }

  const run = operation === 'allocate' ? allocateBalance : reclaimBalance;

  const result = await run({
    userId: body.userId,
    amount: Number(body.amount),
    actorId: auth.user.id,
    reason: body.reason.trim(),
    ip: clientIp(request),
  });

  if (!result.ok) {
    // 409 pour un refus métier (fonds insuffisants), 502 quand le
    // fournisseur est injoignable : l'appelant doit pouvoir distinguer
    // « refusé » de « réessayez ».
    const status =
      result.code === 'PROVIDER_SYNC_FAILED' || result.code === 'PROVIDER_UNAVAILABLE'
        ? 502
        : result.code === 'TRANSACTION_FAILED'
          ? 500
          : 409;

    return NextResponse.json(
      { error: BALANCE_MESSAGE[result.code], code: result.code },
      { status }
    );
  }

  return NextResponse.json({
    ok: true,
    transaction: result.transaction,
    balance: result.balance,
    available: result.available,
  });
}
