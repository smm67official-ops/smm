import { NextResponse, type NextRequest } from 'next/server';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

/**
 * Point d'entrée planifié (Vercel Cron).
 * Vercel appelle cette route en GET avec l'en-tête `authorization: Bearer $CRON_SECRET` ;
 * elle relaie vers /api/smm/status qui porte la logique métier.
 */
export async function GET(request: NextRequest) {
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret && request.headers.get('authorization') !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const origin = new URL(request.url).origin;
  const response = await fetch(`${origin}/api/smm/status`, {
    method: 'POST',
    headers: { 'x-sync-secret': process.env.SMM_SYNC_SECRET ?? '' },
  });

  return NextResponse.json(await response.json().catch(() => ({})), { status: response.status });
}
