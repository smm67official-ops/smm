import { NextResponse, type NextRequest } from 'next/server';
import { requireAdmin } from '@/lib/auth';
import { listWalletTransactions } from '@/lib/wallet';

export const dynamic = 'force-dynamic';

/** Historique des mouvements d'un client, pour le back-office. */
export async function GET(
  _request: NextRequest,
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
  return NextResponse.json({ transactions: await listWalletTransactions(id) });
}
