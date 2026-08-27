import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth';
import { verifyBalances } from '@/lib/balance';

export const dynamic = 'force-dynamic';

/**
 * Vérification de cohérence à la demande.
 *
 * Ne corrige rien : une correction automatique effacerait la trace de
 * l'incident. Elle rapporte, chiffre l'écart, et laisse décider.
 */
export async function GET() {
  const auth = await requireAdmin();
  if (!auth.ok) {
    return NextResponse.json(
      { error: auth.status === 401 ? 'Session expired' : 'Forbidden', code: 'UNAUTHORIZED' },
      { status: auth.status }
    );
  }

  return NextResponse.json(await verifyBalances(auth.user.id));
}
