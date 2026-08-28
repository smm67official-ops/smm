import type { MetadataRoute } from 'next';
import { BRAND } from '@/lib/brand';

/**
 * robots.txt
 *
 * Le back-office, le tunnel de commande et les pages de compte n'ont
 * rien à faire dans un index : ils exigent une session, un robot n'y
 * verrait qu'une redirection, et leur exploration consomme le budget
 * d'exploration au détriment du catalogue.
 *
 * `/auth/` porte des jetons à usage unique dans ses URL : les laisser
 * indexer les exposerait dans les rapports d'outils tiers.
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        disallow: ['/api/', '/auth/', '/admin/', '/*/admin/', '/*/account/', '/*/checkout', '/*/cart'],
      },
    ],
    sitemap: `${BRAND.url}/sitemap.xml`,
    host: BRAND.url,
  };
}
