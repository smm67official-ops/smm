/**
 * Origine à utiliser dans les liens envoyés par e-mail
 * (confirmation d'inscription, réinitialisation de mot de passe).
 *
 * L'ordre de priorité compte. `NEXT_PUBLIC_SITE_URL` est figée à la
 * compilation : si le build de production a été fait avec la valeur du
 * poste de développement, ou si la variable est simplement oubliée sur
 * l'hébergeur, tous les e-mails pointent vers `localhost` et aucun
 * client ne peut activer son compte.
 *
 * `window.location.origin` est, lui, toujours l'hôte réel sur lequel se
 * trouve la personne au moment où elle s'inscrit. On le prend donc en
 * premier : c'est la source qui ne peut pas être fausse.
 *
 * La variable d'environnement ne sert plus que de repli côté serveur,
 * là où `window` n'existe pas.
 */
export function siteOrigin(): string {
  if (typeof window !== 'undefined') return window.location.origin;
  return process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000';
}

/**
 * Lien de retour après confirmation d'e-mail.
 *
 * Attention : Supabase n'honore cette URL que si elle figure dans la
 * liste « Redirect URLs » du projet. Sinon il retombe silencieusement
 * sur la « Site URL » configurée — c'est la seconde cause possible d'un
 * lien vers localhost, et elle ne se corrige pas dans le code.
 */
export function authCallbackUrl(locale: string, next = '/account'): string {
  return `${siteOrigin()}/auth/callback?next=${encodeURIComponent(`/${locale}${next}`)}`;
}
