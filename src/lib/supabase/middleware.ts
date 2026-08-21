import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';
import { LOCALES } from '@/i18n/config';

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

  const {
    data: { user },
  } = await supabase.auth.getUser();

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

    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .maybeSingle();

    const role = profile?.role;
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
