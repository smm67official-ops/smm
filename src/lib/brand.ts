/**
 * Identité de la marque.
 *
 * Source unique : le nom apparaissait auparavant en dur dans l'en-tête,
 * le pied de page, les métadonnées, le message WhatsApp et les trois
 * dictionnaires. Un changement de nom se fait désormais ici (plus les
 * phrases de contenu, qui restent traduites).
 */
export const BRAND = {
  name: 'SMM67',
  tagline: 'Social Media Marketing',

  /**
   * Domaine public, source unique des URL canoniques.
   *
   * Volontairement une constante et non `NEXT_PUBLIC_SITE_URL` : cette
   * variable a déjà pointé vers un hébergement abandonné, et une
   * canonique erronée est pire que pas de canonique — elle désigne aux
   * moteurs une adresse morte comme étant la version de référence.
   *
   * Un changement de domaine se fait ici, et nulle part ailleurs.
   */
  url: 'https://smm67.com',

  /** Compte de contact affiché dans les données structurées. */
  email: 'smm67official@gmail.com',

  /** Logo complet (marque + nom), fond transparent. */
  logo: '/logo/logo96.png',

  /** Visuel principal de la page d'accueil — fond noir, à poser sur sombre. */
  heroImage: '/logo/heroImage.jpeg',
} as const;

/**
 * Documentation de l'API revendeur.
 *
 * Masquée : la page est retirée de la navigation ET la route répond 404.
 * Ne retirer que les liens laisserait la page indexable et accessible à
 * qui connaît l'URL — ce n'est pas « caché », c'est juste discret.
 *
 * Repasser à `true` la réaffiche partout, sans autre modification.
 */
export const API_DOCS_ENABLED = false;

/**
 * Plateformes affichées sous le visuel d'accueil.
 * Les fichiers vivent dans `public/logo/`.
 */
export const HERO_PLATFORMS = [
  { id: 'facebook', label: 'Facebook', icon: '/logo/facebook-icon-small.png' },
  { id: 'instagram', label: 'Instagram', icon: '/logo/instagram-icon-small.png' },
  { id: 'linkedin', label: 'LinkedIn', icon: '/logo/linkedin-icon-small.png' },
  { id: 'spotify', label: 'Spotify', icon: '/logo/spotify-icon-small.png' },
  { id: 'telegram', label: 'Telegram', icon: '/logo/telegram-icon-small.png' },
  { id: 'tiktok', label: 'TikTok', icon: '/logo/tiktok-icon-small.png' },
] as const;
