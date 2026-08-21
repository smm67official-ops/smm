import { NextResponse } from 'next/server';
import { SmmGen, SmmGenError } from '@/lib/smmgen';
import { requireAdmin } from '@/lib/auth';
import { classifyProviderError, PROVIDER_ERROR_MESSAGE } from '@/lib/orders';

export const dynamic = 'force-dynamic';

/**
 * Solde du compte fournisseur (SMMGen, `action=balance`).
 *
 * C'est l'argent réellement disponible pour exécuter les commandes.
 * La clé API ne quitte jamais le serveur : le navigateur n'appelle que
 * cette route, protégée par le rôle admin.
 */
export async function GET() {
  const auth = await requireAdmin();
  if (!auth.ok) {
    return NextResponse.json(
      { error: auth.status === 401 ? 'Session expired' : 'Forbidden' },
      { status: auth.status }
    );
  }

  if (!process.env.SMMGEN_API_KEY) {
    return NextResponse.json({ error: 'SMMGEN_API_KEY is not configured.' }, { status: 400 });
  }

  try {
    const result = await new SmmGen().balance();
    return NextResponse.json({
      ok: true,
      balance: Number(result.balance),
      currency: result.currency ?? 'USD',
      checkedAt: new Date().toISOString(),
    });
  } catch (e) {
    const raw = e instanceof SmmGenError ? e.message : String(e);
    return NextResponse.json(
      { error: PROVIDER_ERROR_MESSAGE[classifyProviderError(raw)] },
      { status: 502 }
    );
  }
}
