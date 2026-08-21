import { NextResponse, type NextRequest } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { requireAdmin } from '@/lib/auth';
import type { Profile, UserRole } from '@/lib/supabase/types';

export const dynamic = 'force-dynamic';

type Params = { params: Promise<{ id: string }> };

const ROLES = ['customer', 'admin', 'support'];

/** Mise à jour d'un profil : identité, rôle, solde, mot de passe. */
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
    username?: string;
    full_name?: string;
    phone?: string;
    role?: string;
    balance?: number;
    password?: string;
  };

  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  if (body.role && !ROLES.includes(body.role)) {
    return NextResponse.json({ error: `Unknown role: ${body.role}` }, { status: 400 });
  }

  // Un administrateur ne peut pas se retirer lui-même ses droits :
  // cela laisserait potentiellement le panel sans aucun admin.
  if (id === auth.user.id && body.role && body.role !== auth.user.role) {
    return NextResponse.json({ error: 'You cannot change your own role.' }, { status: 400 });
  }

  const admin = createAdminClient();

  if (body.password) {
    if (body.password.length < 6) {
      return NextResponse.json({ error: 'Password must be at least 6 characters' }, { status: 400 });
    }
    const { error } = await admin.auth.admin.updateUserById(id, { password: body.password });
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  }

  const patch: Partial<Profile> = {};
  if (body.username !== undefined) patch.username = body.username.trim() || null;
  if (body.full_name !== undefined) patch.full_name = body.full_name.trim() || null;
  if (body.phone !== undefined) patch.phone = body.phone.trim() || null;
  if (body.role !== undefined) patch.role = body.role as UserRole;
  if (body.balance !== undefined) {
    const balance = Number(body.balance);
    if (!Number.isFinite(balance) || balance < 0) {
      return NextResponse.json({ error: 'Balance must be a positive number' }, { status: 400 });
    }
    patch.balance = balance;
  }

  if (Object.keys(patch).length > 0) {
    const { error } = await admin.from('profiles').update(patch).eq('id', id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}

/** Suppression d'un compte (le profil part en cascade). */
export async function DELETE(_request: NextRequest, { params }: Params) {
  const auth = await requireAdmin();
  if (!auth.ok) {
    return NextResponse.json(
      { error: auth.status === 401 ? 'Session expired' : 'Forbidden' },
      { status: auth.status }
    );
  }

  const { id } = await params;
  if (id === auth.user.id) {
    return NextResponse.json({ error: 'You cannot delete your own account.' }, { status: 400 });
  }

  const admin = createAdminClient();
  const { error } = await admin.auth.admin.deleteUser(id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true });
}
