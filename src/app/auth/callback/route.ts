import { NextResponse, type NextRequest } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { audit, clientIp } from '@/lib/audit';
import { DEFAULT_LOCALE, isLocale } from '@/i18n/config';

/**
 * Cible des liens de confirmation d'e-mail, de réinitialisation de mot
 * de passe et des retours OAuth. Échange le `code` contre une session,
 * puis renvoie vers `next`.
 */

/**
 * Toutes les pages vivent sous `/[locale]/`. Les redirections d'ici
 * doivent donc être préfixées : renvoyer vers `/login` obligeait le
 * middleware à un second saut, une dépendance fragile derrière un CDN.
 * La langue est déduite de `next`, sinon on retombe sur la langue par
 * défaut.
 */
function localeOf(next: string): string {
  const first = next.split('/').filter(Boolean)[0];
  return isLocale(first) ? first : DEFAULT_LOCALE;
}

/**
 * `next` vient de l'URL : il ne doit pouvoir désigner qu'un chemin
 * interne. Un `next` absolu (`https://ailleurs`) transformerait ce point
 * d'entrée en redirecteur ouvert, commode pour du hameçonnage.
 */
function safeNext(raw: string | null): string {
  if (!raw) return `/${DEFAULT_LOCALE}/account`;
  if (!raw.startsWith('/') || raw.startsWith('//')) return `/${DEFAULT_LOCALE}/account`;

  const first = raw.split('/').filter(Boolean)[0];
  if (!isLocale(first)) return `/${DEFAULT_LOCALE}${raw}`;
  return raw;
}

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get('code');
  const next = safeNext(searchParams.get('next'));
  const locale = localeOf(next);

  const loginUrl = (error?: string) =>
    `${origin}/${locale}/login${error ? `?error=${encodeURIComponent(error)}` : ''}`;

  if (!code) {
    // Lien ouvert sans code : expiré, déjà utilisé, ou tronqué par le
    // client de messagerie.
    return NextResponse.redirect(loginUrl('missing_code'));
  }

  const supabase = await createClient();
  const { data, error } = await supabase.auth.exchangeCodeForSession(code);

  if (error) {
    console.error('[auth/callback]', error.message);
    return NextResponse.redirect(loginUrl(error.message));
  }

  const user = data.user;

  if (user) {
    /*
      Le profil est normalement créé par le trigger `on_auth_user_created`.
      Une première connexion Google apporte cependant un nom et un avatar
      que l'inscription par mot de passe n'a pas : on complète les champs
      restés vides, sans jamais écraser ce que le client a saisi lui-même.
    */
    const admin = createAdminClient();
    const meta = (user.user_metadata ?? {}) as Record<string, string | undefined>;

    const { data: profile } = await admin
      .from('profiles')
      .select('id, full_name, avatar_url, is_blocked, onboarded_at')
      .eq('id', user.id)
      .maybeSingle();

    if (profile) {
      const patch: { full_name?: string; avatar_url?: string } = {};
      if (!profile.full_name && (meta.full_name || meta.name)) {
        patch.full_name = (meta.full_name ?? meta.name)!;
      }
      if (!profile.avatar_url && (meta.avatar_url || meta.picture)) {
        patch.avatar_url = (meta.avatar_url ?? meta.picture)!;
      }
      if (Object.keys(patch).length > 0) {
        await admin.from('profiles').update(patch).eq('id', user.id);
      }

      // Un compte suspendu ne doit pas repartir avec une session valide.
      if (profile.is_blocked) {
        await supabase.auth.signOut();
        return NextResponse.redirect(loginUrl('account_blocked'));
      }
    }

    await audit({
      action: user.app_metadata?.provider === 'google' ? 'GOOGLE_LOGIN' : 'LOGIN',
      actorId: user.id,
      targetId: user.id,
      targetType: 'profile',
      metadata: { provider: user.app_metadata?.provider ?? 'email' },
      ip: clientIp(request),
    });

    /*
      Compte neuf : Google fournit un e-mail et un nom, jamais un numéro
      de téléphone. On demande donc le WhatsApp et les plateformes avant
      d'ouvrir le tableau de bord — sans ce numéro, le client est
      injoignable pour une recharge ou une commande.

      `onboarded_at === undefined` signifie que la colonne n'existe pas
      encore (migration 010) : l'étape est alors ignorée, et la connexion
      se termine comme avant.
    */
    if (profile && profile.onboarded_at === null) {
      return NextResponse.redirect(`${origin}/${locale}/onboarding`);
    }
  }

  return NextResponse.redirect(`${origin}${next}`);
}

export const dynamic = 'force-dynamic';
