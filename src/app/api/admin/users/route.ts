import { NextResponse, type NextRequest } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { requireAdmin } from '@/lib/auth';

export const dynamic = 'force-dynamic';

const guard = async () => {
  const auth = await requireAdmin();
  if (!auth.ok) {
    return {
      response: NextResponse.json(
        { error: auth.status === 401 ? 'Session expired' : 'Forbidden' },
        { status: auth.status }
      ),
    };
  }
  return { auth };
};

/** Création d'un utilisateur depuis le back-office (e-mail pré-confirmé). */
export async function POST(request: NextRequest) {
  const { response } = await guard();
  if (response) return response;

  let body: {
    email?: string;
    password?: string;
    username?: string;
    full_name?: string;
    role?: string;
  };

  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  if (!body.email || !body.password) {
    return NextResponse.json({ error: 'Email and password are required' }, { status: 400 });
  }
  if (body.password.length < 6) {
    return NextResponse.json({ error: 'Password must be at least 6 characters' }, { status: 400 });
  }

  const role = body.role ?? 'customer';
  if (!['customer', 'admin', 'support'].includes(role)) {
    return NextResponse.json({ error: `Unknown role: ${role}` }, { status: 400 });
  }

  const admin = createAdminClient();

  const { data, error } = await admin.auth.admin.createUser({
    email: body.email.trim(),
    password: body.password,
    email_confirm: true,
    user_metadata: { username: body.username, full_name: body.full_name },
  });

  if (error || !data.user) {
    return NextResponse.json({ error: error?.message ?? 'User creation failed' }, { status: 400 });
  }

  // Le trigger `handle_new_user` a déjà créé le profil : on le complète.
  const { error: profileError } = await admin
    .from('profiles')
    .update({
      username: body.username?.trim() || null,
      full_name: body.full_name?.trim() || null,
      role: role as never,
    })
    .eq('id', data.user.id);

  if (profileError) {
    return NextResponse.json({ error: profileError.message, userId: data.user.id }, { status: 500 });
  }

  return NextResponse.json({ ok: true, userId: data.user.id });
}
