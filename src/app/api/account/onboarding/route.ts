import { NextResponse, type NextRequest } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getSessionUser } from '@/lib/auth';
import { ONBOARDING_MESSAGE, validateOnboarding } from '@/lib/onboarding';

export const dynamic = 'force-dynamic';

/**
 * Finalisation du profil après une première connexion.
 *
 * L'écriture passe par la session du client, pas par la clé de service :
 * la politique « own profile update » limite déjà chacun à sa propre
 * ligne, et les triggers protègent `role`, `balance` et `is_blocked`.
 * Utiliser la clé de service ici reviendrait à contourner ces garde-fous
 * pour une opération qui n'en a pas besoin.
 */
export async function POST(request: NextRequest) {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: 'Sign in first.', code: 'UNAUTHORIZED' }, { status: 401 });
  }

  if (user.blocked) {
    return NextResponse.json({ error: 'Account blocked.', code: 'USER_BLOCKED' }, { status: 403 });
  }

  let body: { whatsapp?: unknown; platforms?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const parsed = validateOnboarding(body);
  if (!parsed.ok) {
    return NextResponse.json(
      { error: ONBOARDING_MESSAGE[parsed.error], code: parsed.error },
      { status: 400 }
    );
  }

  const supabase = await createClient();

  const { error } = await supabase
    .from('profiles')
    .update({
      whatsapp: parsed.whatsapp,
      platforms: parsed.platforms,
      onboarded_at: new Date().toISOString(),
    })
    .eq('id', user.id);

  if (error) {
    if (/column .*(whatsapp|platforms|onboarded_at).* does not exist|schema cache/i.test(error.message)) {
      return NextResponse.json(
        { error: 'Onboarding needs migration 010 — run it in the Supabase SQL editor.' },
        { status: 409 }
      );
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
