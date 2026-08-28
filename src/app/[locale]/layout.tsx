import { Suspense } from 'react';
import type { Metadata, Viewport } from 'next';
import { notFound } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { hasSupabaseEnv } from '@/lib/queries';
import { getDictionary } from '@/i18n';
import { DEFAULT_LOCALE, LOCALES, dirOf, isLocale, type Locale } from '@/i18n/config';
import { BRAND } from '@/lib/brand';
import { BasketProvider } from '@/components/providers/BasketProvider';
import Header from '@/components/layout/Header';
import Footer from '@/components/layout/Footer';
import SiteChrome from '@/components/layout/SiteChrome';
import BottomNav from '@/components/layout/BottomNav';
import ClientChrome from '@/components/layout/ClientChrome';
import MotionProvider from '@/components/motion/MotionProvider';
import RouteProgress from '@/components/motion/RouteProgress';
import { CxToastProvider } from '@/components/motion/ToastProvider';
import ScrollToTop from '@/components/layout/ScrollToTop';
import StructuredData from '@/components/seo/StructuredData';
import { getActiveWhatsAppNumber } from '@/lib/settings';

type Params = Promise<{ locale: string }>;

/** viewport-fit: cover — les encoches iOS sont gérées par env(safe-area-inset-*). */
export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
  themeColor: '#ffffff',
};

export function generateStaticParams() {
  return LOCALES.map((locale) => ({ locale }));
}

/** Codes de langue complets attendus par Open Graph (`fr` -> `fr_FR`). */
const OG_LOCALE: Record<string, string> = { fr: 'fr_FR', en: 'en_US', ar: 'ar_MA' };

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { locale } = await params;
  const t = getDictionary(locale);

  return {
    /*
      `metadataBase` rend absolues toutes les URL relatives déclarées
      ci-dessous. Sans elle, Next.js émet des avertissements et les
      images Open Graph partent en chemin relatif — que ni Facebook ni
      WhatsApp ne savent résoudre.
    */
    metadataBase: new URL(BRAND.url),

    title: { default: t.meta.title, template: `%s | ${BRAND.name}` },
    description: t.meta.description,
    applicationName: BRAND.name,
    icons: { icon: '/assets/images/favicon.ico', apple: '/assets/images/favicon.png' },

    /*
      Canonique et versions traduites.

      Les trois langues servent le même contenu à trois adresses : sans
      `canonical`, les moteurs y voient du contenu dupliqué et n'en
      retiennent qu'une, choisie par eux. `x-default` désigne la version
      proposée à un visiteur dont la langue ne correspond à aucune des
      nôtres.
    */
    alternates: {
      canonical: `/${locale}`,
      languages: {
        ...Object.fromEntries(LOCALES.map((l) => [l, `/${l}`])),
        'x-default': `/${DEFAULT_LOCALE}`,
      },
    },

    openGraph: {
      type: 'website',
      siteName: BRAND.name,
      title: t.meta.title,
      description: t.meta.description,
      url: `/${locale}`,
      locale: OG_LOCALE[locale] ?? 'en_US',
      alternateLocale: LOCALES.filter((l) => l !== locale).map((l) => OG_LOCALE[l] ?? l),
    },

    twitter: {
      card: 'summary_large_image',
      title: t.meta.title,
      description: t.meta.description,
    },

    robots: {
      index: true,
      follow: true,
      googleBot: {
        index: true,
        follow: true,
        // Sans ces trois valeurs, Google tronque l'extrait et l'aperçu
        // d'image à sa guise ; on demande explicitement le maximum.
        'max-snippet': -1,
        'max-image-preview': 'large',
        'max-video-preview': -1,
      },
    },
  };
}

export default async function LocaleLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Params;
}) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();

  const t = getDictionary(locale);
  const dir = dirOf(locale as Locale);

  // Numéro de contact publié dans les données structurées.
  const businessWhatsapp = await getActiveWhatsAppNumber();

  // Origine Supabase, pour préétablir la connexion (voir <head>).
  const supabaseOrigin = process.env.NEXT_PUBLIC_SUPABASE_URL
    ? new URL(process.env.NEXT_PUBLIC_SUPABASE_URL).origin
    : null;

  // Sans configuration Supabase, l'en-tête s'affiche en mode visiteur.
  let email: string | null = null;
  let userId: string | null = null;
  let role: string | null = null;
  let fullName: string | null = null;
  if (hasSupabaseEnv()) {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    email = user?.email ?? null;
    userId = user?.id ?? null;

    // Le rôle sert uniquement à afficher le raccourci vers l'espace
    // d'administration : l'accès réel reste vérifié par le middleware,
    // le layout admin et la RLS.
    if (user) {
      const { data: profile } = await supabase
        .from('profiles')
        .select('role, full_name, username')
        .eq('id', user.id)
        .maybeSingle();
      role = profile?.role ?? null;
      fullName = profile?.full_name || profile?.username || null;
    }
  }

  return (
    /*
      Le script en ligne ci-dessous pose une classe sur <html> avant
      l'hydratation : React signalerait sinon une divergence entre le
      balisage serveur et le DOM. La différence est voulue et sans effet
      sur l'arbre React.
    */
    <html lang={locale} dir={dir} suppressHydrationWarning>
      <head>
        <link rel="stylesheet" href="/assets/css/vendors/bootstrap.min.css" />
        <link rel="stylesheet" href="/assets/css/vendors/ionicons.min.css" />
        <link rel="stylesheet" href="/assets/css/style.css" />
        <link rel="stylesheet" href="/assets/css/next-overrides.css" />
        <link rel="stylesheet" href="/assets/css/smm-sections.css" />
        <link rel="stylesheet" href="/assets/css/hero.css" />
        <link rel="stylesheet" href="/assets/css/client-app.css" />
        <link rel="stylesheet" href="/assets/css/responsive.css" />
        <link rel="stylesheet" href="/assets/css/motion.css" />
        {dir === 'rtl' && <link rel="stylesheet" href="/assets/css/rtl.css" />}

        {/* Établit la connexion à Supabase avant que le navigateur n'en
            ait besoin : la première requête d'authentification économise
            ainsi la négociation DNS et TLS. */}
        {supabaseOrigin && (
          <>
            <link rel="preconnect" href={supabaseOrigin} crossOrigin="" />
            <link rel="dns-prefetch" href={supabaseOrigin} />
          </>
        )}

        <StructuredData locale={locale} t={t} whatsapp={businessWhatsapp} />
      </head>
      <body>
        {/*
          Pose l'état initial du mouvement avant la première peinture.
          Sans ce marqueur, le contenu rendu par le serveur s'affiche puis
          se cache à l'hydratation — un clignotement à chaque chargement.
          `MotionProvider` retire la classe dès que GSAP a pris la main,
          ce qui garantit que le contenu reste visible si le script échoue.
        */}
        <script
          dangerouslySetInnerHTML={{
            __html:
              "try{if(!matchMedia('(prefers-reduced-motion: reduce)').matches)document.documentElement.classList.add('has-motion')}catch(e){}",
          }}
        />
        <BasketProvider userId={userId}>
          <CxToastProvider>
            {/* `useSearchParams` impose une frontière Suspense au rendu statique. */}
            <Suspense fallback={null}>
              <RouteProgress />
            </Suspense>
            <ClientChrome locale={locale as Locale} t={t} email={email} name={fullName} />
            <div id="wrapper" className="wrapper">
              <SiteChrome>
                <Header locale={locale as Locale} t={t} userEmail={email} userRole={role} />
              </SiteChrome>
              <MotionProvider>{children}</MotionProvider>
              <SiteChrome>
                <Footer locale={locale as Locale} t={t} />
              </SiteChrome>
            </div>
            <BottomNav locale={locale as Locale} t={t} signedIn={Boolean(email)} />
            <ScrollToTop />
          </CxToastProvider>
        </BasketProvider>
      </body>
    </html>
  );
}
