import { NextResponse, type NextRequest } from 'next/server';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

/** Import quotidien du catalogue fournisseur (Vercel Cron → /api/smm/sync). */
export async function GET(request: NextRequest) {
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret && request.headers.get('authorization') !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const origin = new URL(request.url).origin;
  const response = await fetch(`${origin}/api/smm/sync`, {
    method: 'POST',
    headers: { 'x-sync-secret': process.env.SMM_SYNC_SECRET ?? '' },
  });

  return NextResponse.json(await response.json().catch(() => ({})), { status: response.status });
}
