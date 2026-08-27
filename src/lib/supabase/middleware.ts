import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';
import { LOCALES } from '@/i18n/config';

/**
 * Délai au-delà duquel on cesse d'attendre Supabase.
 *
 * Le middleware s'exécute sur CHAQUE requête, y compris la page
 * d'accueil et le catalogue, qui n'ont aucun besoin de session. Une
 * lenteur de Supabase — projet en veille, incident réseau — bloquait
 * donc tout le site derrière un appel d'authentification, jusqu'au
 * `MIDDLEWARE_INVOCATION_TIMEOUT` de Vercel : une erreur 504 sur des
 * pages entièrement publiques.
 *
 * Deux secondes suffisent très largement à une réponse normale (mesurée
 * autour de 200 ms). Au-delà, on rend la main plutôt que de faire
 * attendre le visiteur.
 */
const AUTH_TIMEOUT_MS = 2000;

/**
 * Attend une promesse, ou abandonne.
 *
 * `null` signifie « je ne sais pas », et non « pas de session » : les
 * appelants distinguent les deux, car rediriger vers la connexion sur
 * une simple lenteur déconnecterait des visiteurs parfaitement
 * authentifiés.
 */
async function withTimeout<T>(promise: Promise<T>): Promise<T | null> {
  let timer: ReturnType<typeof setTimeout> | undefined;

  const timeout = new Promise<null>((resolve) => {
    timer = setTimeout(() => resolve(null), AUTH_TIMEOUT_MS);
  });

  try {
    return await Promise.race([promise, timeout]);
  } catch {
    // Panne réseau : même traitement qu'un dépassement de délai.
    return null;
  } finally {
    if (timer) clearTimeout(timer);
  }
}

/** Retire le préfixe de langue : `/ar/account` → `/account`. */
function stripLocale(pathname: string) {
  for (const locale of LOCALES) {
    if (pathname === `/${locale}`) return '/';
    if (pathname.startsWith(`/${locale}/`)) return pathname.slice(locale.length + 1);
  }
  return pathname;
}

/** Rafraîchit le cookie de session à chaque requête et protège /account. */
export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request });

  // Tant que le projet n'est pas configuré, on laisse passer sans session.
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    return response;
  }

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  const session = await withTimeout(supabase.auth.getUser());

  /*
    Supabase n'a pas répondu à temps. On laisse passer sans rien décider :
    le middleware n'est qu'un raccourci d'expérience, la protection réelle
    tient dans les gardes de page (`requireAdmin`, `getSessionUser`) et
    surtout dans la RLS, qui ne dépend d'aucun délai. Bloquer ou rediriger
    ici transformerait une lenteur en panne, ou en déconnexion.
  */
  if (session === null) return response;

  const user = session.data.user;

  const { pathname } = request.nextUrl;
  const locale = pathname.split('/')[1];
  const route = stripLocale(pathname);

  if (!user && route.startsWith('/account')) {
    const url = request.nextUrl.clone();
    url.pathname = `/${locale}/login`;
    url.searchParams.set('redirect', pathname);
    return NextResponse.redirect(url);
  }

  // Espace d'administration : session + rôle admin/support obligatoires.
  // La RLS reste la protection de fond, ce contrôle évite d'afficher la page.
  if (route.startsWith('/admin') && route !== '/admin/login') {
    if (!user) {
      const url = request.nextUrl.clone();
      url.pathname = `/${locale}/admin/login`;
      url.searchParams.set('redirect', pathname);
      return NextResponse.redirect(url);
    }

    const lookup = await withTimeout(
      Promise.resolve(
        supabase.from('profiles').select('role').eq('id', user.id).maybeSingle()
      )
    );

    // Rôle indéterminé : la page d'administration refera le contrôle
    // côté serveur, et la RLS bloquera toute lecture non autorisée.
    if (lookup === null) return response;

    const role = lookup.data?.role;
    if (role !== 'admin' && role !== 'support') {
      const url = request.nextUrl.clone();
      url.pathname = `/${locale}/admin/login`;
      url.searchParams.set('error', 'forbidden');
      return NextResponse.redirect(url);
    }
  }

  if (user && (route === '/login' || route === '/signup')) {
    const url = request.nextUrl.clone();
    url.pathname = `/${locale}/account`;
    url.search = '';
    return NextResponse.redirect(url);
  }

  return response;
}
