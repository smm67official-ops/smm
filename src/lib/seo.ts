/**
 * Aides pour les métadonnées.
 */

/**
 * Coupe un texte sans casser un mot.
 *
 * `slice(0, n)` produit « prix à partir d », qui donne l'impression d'un
 * texte tronqué par accident. On recule jusqu'à la dernière espace et
 * l'on marque la coupure — le lecteur comprend alors que la suite existe.
 *
 * Sans espace en amont (mot unique très long, écriture non segmentée),
 * on retombe sur une coupe franche : mieux vaut un mot coupé qu'une
 * chaîne vide.
 */
export function truncate(text: string, max: number): string {
  const clean = (text ?? '').replace(/\s+/g, ' ').trim();
  if (clean.length <= max) return clean;

  const cut = clean.slice(0, max - 1);
  const space = cut.lastIndexOf(' ');

  return `${(space > max * 0.6 ? cut.slice(0, space) : cut).trimEnd()}…`;
}

/**
 * Longueur utile d'une méta-description.
 *
 * Au-delà d'environ 160 caractères, les moteurs coupent eux-mêmes, à un
 * endroit qu'ils choisissent. Autant décider de la fin de la phrase.
 */
export const META_DESCRIPTION_MAX = 158;
