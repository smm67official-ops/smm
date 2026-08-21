import { NextResponse, type NextRequest } from 'next/server';
import { requireAdmin } from '@/lib/auth';

export const dynamic = 'force-dynamic';
export const maxDuration = 120;

/**
 * Déclenche la synchronisation depuis le back-office.
 * Le secret de synchronisation reste côté serveur : le navigateur ne
 * connaît que cette route, protégée par le rôle admin.
 */
export async function POST(request: NextRequest) {
  const auth = await requireAdmin();
  if (!auth.ok) {
    return NextResponse.json(
      { error: auth.status === 401 ? 'Session expired' : 'Forbidden' },
      { status: auth.status }
    );
  }

  const target = new URL(request.url).searchParams.get('target') === 'status' ? 'status' : 'sync';
  const origin = new URL(request.url).origin;

  const response = await fetch(`${origin}/api/smm/${target}`, {
    method: 'POST',
    headers: { 'x-sync-secret': process.env.SMM_SYNC_SECRET ?? '' },
  });

  const result = await response.json().catch(() => ({ error: 'Provider sync failed' }));
  return NextResponse.json(result, { status: response.status });
}
