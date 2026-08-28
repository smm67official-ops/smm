import { BRAND } from '@/lib/brand';
import type { Dictionary } from '@/i18n';

/**
 * Données structurées (JSON-LD).
 *
 * Décrivent aux moteurs ce qu'est le site plutôt que de les laisser le
 * déduire du texte : l'organisation, le nom de marque, et le fait qu'une
 * recherche interne existe — ce qui autorise Google à afficher un champ
 * de recherche directement dans ses résultats.
 *
 * Rendu côté serveur, sans script exécutable : `application/ld+json`
 * n'est pas interprété comme du JavaScript par le navigateur.
 */
export default function StructuredData({
  locale,
  t,
  whatsapp,
}: {
  locale: string;
  t: Dictionary;
  whatsapp?: string | null;
}) {
  const base = `${BRAND.url}/${locale}`;

  const organization = {
    '@type': 'Organization',
    '@id': `${BRAND.url}/#organization`,
    name: BRAND.name,
    url: BRAND.url,
    description: t.meta.description,
    logo: { '@type': 'ImageObject', url: `${BRAND.url}${BRAND.logo}` },
    email: BRAND.email,
    ...(whatsapp
      ? {
          contactPoint: {
            '@type': 'ContactPoint',
            contactType: 'customer support',
            telephone: `+${whatsapp}`,
            availableLanguage: ['French', 'English', 'Arabic'],
          },
        }
      : {}),
  };

  const website = {
    '@type': 'WebSite',
    '@id': `${BRAND.url}/#website`,
    url: base,
    name: BRAND.name,
    description: t.meta.description,
    inLanguage: locale,
    publisher: { '@id': `${BRAND.url}/#organization` },
    /*
      Recherche interne déclarée : Google peut alors proposer un champ de
      recherche dans ses résultats. Le motif doit correspondre à une URL
      réellement servie, sinon la déclaration est ignorée.
    */
    potentialAction: {
      '@type': 'SearchAction',
      target: {
        '@type': 'EntryPoint',
        urlTemplate: `${base}/services?q={search_term_string}`,
      },
      'query-input': 'required name=search_term_string',
    },
  };

  const graph = { '@context': 'https://schema.org', '@graph': [organization, website] };

  return (
    <script
      type="application/ld+json"
      // Le contenu vient de constantes et de dictionnaires, jamais d'une
      // saisie client : aucune injection possible par cette voie.
      dangerouslySetInnerHTML={{ __html: JSON.stringify(graph) }}
    />
  );
}
