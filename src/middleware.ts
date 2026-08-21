import { NextResponse, type NextRequest } from 'next/server';
import { updateSession } from '@/lib/supabase/middleware';
import { DEFAULT_LOCALE, LOCALES, isLocale, type Locale } from '@/i18n/config';

const LOCALE_COOKIE = 'NEXT_LOCALE';

/** Langue préférée : cookie, puis en-tête Accept-Language, puis défaut. */
function preferredLocale(request: NextRequest): Locale {
  const cookie = request.cookies.get(LOCALE_COOKIE)?.value;
  if (cookie && isLocale(cookie)) return cookie;

  const header = request.headers.get('accept-language') ?? '';
  for (const part of header.split(',')) {
    const code = part.trim().split(';')[0].split('-')[0].toLowerCase();
    if (isLocale(code)) return code;
  }

  return DEFAULT_LOCALE;
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  const hasLocale = LOCALES.some(
    (l) => pathname === `/${l}` || pathname.startsWith(`/${l}/`)
  );

  if (!hasLocale) {
    const url = request.nextUrl.clone();
    url.pathname = `/${preferredLocale(request)}${pathname === '/' ? '' : pathname}`;
    return NextResponse.redirect(url);
  }

  return updateSession(request);
}

export const config = {
  matcher: [
    // Tout sauf les fichiers statiques, les assets du thème et les routes API/auth.
    // `design-system` est la page de référence du design system : elle a son
    // propre layout et ne doit pas être préfixée par une langue.
    '/((?!api|auth|design-system|_next/static|_next/image|assets|favicon.ico|.*\\.(?:png|jpg|jpeg|gif|svg|ico|css|js|map|woff|woff2|ttf|eot)$).*)',
  ],
};
