import type { MetadataRoute } from 'next';
import { BRAND } from '@/lib/brand';
import { LOCALES } from '@/i18n/config';
import { createAdminClient } from '@/lib/supabase/admin';
import { hasSupabaseEnv } from '@/lib/queries';

export const revalidate = 3600;

/** Pages fixes, hors espaces privés. */
const STATIC_PATHS = ['', '/services', '/contact', '/login', '/signup'] as const;

/**
 * Plan du site.
 *
 * Les trois langues d'une même page sont déclarées entre elles par
 * `alternates.languages` : sans cela, chaque traduction serait vue comme
 * une page distincte traitant du même sujet, et les moteurs n'en
 * retiendraient qu'une.
 *
 * Le catalogue est borné à 5 000 fiches. La limite d'un plan de site est
 * de 50 000 URL, mais en publier des milliers de qualité inégale dilue
 * l'exploration ; les services actifs les plus récents suffisent à ouvrir
 * la porte, le maillage interne fait le reste.
 */
const SERVICE_LIMIT = 5000;

function entry(path: string, priority: number, frequency: 'daily' | 'weekly' | 'monthly') {
  return LOCALES.map((locale) => ({
    url: `${BRAND.url}/${locale}${path}`,
    lastModified: new Date(),
    changeFrequency: frequency,
    priority,
    alternates: {
      languages: Object.fromEntries(LOCALES.map((l) => [l, `${BRAND.url}/${l}${path}`])),
    },
  }));
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const pages = STATIC_PATHS.flatMap((path) =>
    entry(path, path === '' ? 1 : 0.8, path === '' ? 'daily' : 'weekly')
  );

  if (!hasSupabaseEnv()) return pages;

  try {
    const admin = createAdminClient();
    const { data } = await admin
      .from('services')
      .select('id, synced_at')
      .eq('is_active', true)
      .order('synced_at', { ascending: false })
      .limit(SERVICE_LIMIT);

    const services = (data ?? []).flatMap((service) =>
      LOCALES.map((locale) => ({
        url: `${BRAND.url}/${locale}/services/${service.id}`,
        lastModified: service.synced_at ? new Date(service.synced_at) : new Date(),
        changeFrequency: 'weekly' as const,
        priority: 0.6,
        alternates: {
          languages: Object.fromEntries(
            LOCALES.map((l) => [l, `${BRAND.url}/${l}/services/${service.id}`])
          ),
        },
      }))
    );

    return [...pages, ...services];
  } catch {
    // Base indisponible : un plan de site réduit vaut mieux qu'une
    // erreur 500, qui ferait renoncer le robot à revenir de sitôt.
    return pages;
  }
}
