import { NextResponse, type NextRequest } from 'next/server';
import { requireAdmin } from '@/lib/auth';
import { walletApply } from '@/lib/wallet';
import type { WalletTransactionType } from '@/lib/supabase/types';

export const dynamic = 'force-dynamic';

const TYPES: WalletTransactionType[] = ['CREDIT', 'DEBIT', 'REFUND', 'ADJUSTMENT'];

/**
 * Mouvement de portefeuille déclenché par un administrateur.
 * Seule voie d'écriture du solde depuis l'interface : le trigger
 * `protect_profile_balance` interdit toute modification directe.
 */
export async function POST(request: NextRequest) {
  const auth = await requireAdmin();
  if (!auth.ok) {
    return NextResponse.json(
      { error: auth.status === 401 ? 'Session expired' : 'Forbidden' },
      { status: auth.status }
    );
  }

  let body: { userId?: string; type?: string; amount?: number; reason?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  if (!body.userId) {
    return NextResponse.json({ error: 'A customer is required' }, { status: 400 });
  }

  const type = body.type as WalletTransactionType | undefined;
  if (!type || !TYPES.includes(type)) {
    return NextResponse.json({ error: `Unknown transaction type: ${body.type}` }, { status: 400 });
  }

  const amount = Number(body.amount);
  if (!Number.isFinite(amount) || amount === 0) {
    return NextResponse.json({ error: 'Amount must be a non-zero number' }, { status: 400 });
  }

  // Seul un ajustement peut être négatif ; pour retirer des fonds, utiliser DEBIT.
  if (type !== 'ADJUSTMENT' && amount < 0) {
    return NextResponse.json(
      { error: 'Only an ADJUSTMENT can be negative. Use DEBIT to remove funds.' },
      { status: 400 }
    );
  }

  if (!body.reason?.trim()) {
    return NextResponse.json({ error: 'A reason is required for the audit trail' }, { status: 400 });
  }

  const result = await walletApply({
    userId: body.userId,
    type,
    amount,
    reason: body.reason.trim(),
    actorId: auth.user.id,
  });

  if (!result.ok) {
    const status = result.code === 'INSUFFICIENT_FUNDS' ? 400 : 500;
    const message =
      result.code === 'INSUFFICIENT_FUNDS'
        ? 'This would take the wallet below zero.'
        : result.code === 'UNKNOWN_WALLET'
          ? 'Unknown customer.'
          : result.message;

    return NextResponse.json({ error: message, code: result.code }, { status });
  }

  return NextResponse.json({
    ok: true,
    transaction: result.transaction,
    balance: result.transaction.balance_after,
  });
}
