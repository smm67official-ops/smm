import { NextResponse, type NextRequest } from 'next/server';
import { createClient } from '@/lib/supabase/server';
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
  const { error } = await supabase.auth.exchangeCodeForSession(code);

  if (error) {
    console.error('[auth/callback]', error.message);
    return NextResponse.redirect(loginUrl(error.message));
  }

  return NextResponse.redirect(`${origin}${next}`);
}

export const dynamic = 'force-dynamic';
