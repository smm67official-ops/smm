import { NextResponse, type NextRequest } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { requireAdmin } from '@/lib/auth';
import type { Service } from '@/lib/supabase/types';

export const dynamic = 'force-dynamic';

type Params = { params: Promise<{ id: string }> };

/**
 * Ajustement manuel d'un service : nom affiché, prix de vente,
 * disponibilité, bornes.
 *
 * Le prix fournisseur (`provider_rate`) et le libellé d'origine
 * (`provider_name`) ne sont jamais modifiables ici : ils sont réécrits à
 * chaque synchronisation et servent de référence face au fournisseur.
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

  let body: {
    name?: string;
    rate?: number;
    is_active?: boolean;
    min?: number;
    max?: number;
    unlockRate?: boolean;
    unlockName?: boolean;
  };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const patch: Partial<Service> = {};

  if (body.name !== undefined) {
    const name = body.name.trim();
    if (!name) {
      return NextResponse.json({ error: 'Name cannot be empty' }, { status: 400 });
    }
    if (name.length > 200) {
      return NextResponse.json({ error: 'Name is too long (200 characters max)' }, { status: 400 });
    }
    patch.name = name;
    // Un nom saisi à la main est protégé de la prochaine synchronisation.
    patch.name_locked = true;
  }

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

  /*
    Retour au libellé fournisseur. On le restaure tout de suite plutôt
    que d'attendre la synchronisation : sinon le nom réécrit resterait
    affiché en boutique jusqu'au prochain import, sans que rien ne
    l'indique.
  */
  if (body.unlockName) {
    patch.name_locked = false;

    const { data: current } = await createAdminClient()
      .from('services')
      .select('provider_name')
      .eq('id', id)
      .maybeSingle();

    if (current?.provider_name) patch.name = current.provider_name;
  }

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

  if (error) {
    // Migration 008 non appliquée : le diagnostic doit être lisible dans
    // l'interface, pas seulement dans les journaux du serveur.
    if (/column .*(name_locked|provider_name).* does not exist|schema cache/i.test(error.message)) {
      return NextResponse.json(
        { error: 'Renaming needs migration 008 — run it in the Supabase SQL editor.' },
        { status: 409 }
      );
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
