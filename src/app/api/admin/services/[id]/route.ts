import { NextResponse, type NextRequest } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { requireAdmin } from '@/lib/auth';
import type { Service } from '@/lib/supabase/types';

export const dynamic = 'force-dynamic';

type Params = { params: Promise<{ id: string }> };

/**
 * Ajustement manuel d'un service : prix de vente, disponibilité, bornes.
 * Le prix fournisseur (`provider_rate`) n'est jamais modifiable ici : il
 * est écrasé à chaque synchronisation.
 */
export async function PATCH(request: NextRequest, { params }: Params) {
  const auth = await requireAdmin();
  if (!auth.ok) {
    return NextResponse.json(
      { error: auth.status === 401 ? 'Session expired' : 'Forbidden' },
      { status: auth.status }
    );
  }

  const { id } = await params;

  let body: { rate?: number; is_active?: boolean; min?: number; max?: number; unlockRate?: boolean };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const patch: Partial<Service> = {};

  if (body.rate !== undefined) {
    const rate = Number(body.rate);
    if (!Number.isFinite(rate) || rate < 0) {
      return NextResponse.json({ error: 'Rate must be a positive number' }, { status: 400 });
    }
    patch.rate = rate;
    // Un prix saisi à la main est protégé de la prochaine synchronisation.
    patch.rate_locked = true;
  }

  // Retour au calcul automatique : le prochain import recalculera la marge.
  if (body.unlockRate) patch.rate_locked = false;

  if (body.is_active !== undefined) patch.is_active = Boolean(body.is_active);

  if (body.min !== undefined) {
    const min = Number(body.min);
    if (!Number.isInteger(min) || min < 1) {
      return NextResponse.json({ error: 'Min must be a positive integer' }, { status: 400 });
    }
    patch.min = min;
  }

  if (body.max !== undefined) {
    const max = Number(body.max);
    if (!Number.isInteger(max) || max < 1) {
      return NextResponse.json({ error: 'Max must be a positive integer' }, { status: 400 });
    }
    patch.max = max;
  }

  if (Object.keys(patch).length === 0) {
    return NextResponse.json({ error: 'Nothing to update' }, { status: 400 });
  }

  const admin = createAdminClient();
  const { error } = await admin.from('services').update(patch).eq('id', id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true });
}
