/**
 * Tarification — source unique.
 *
 * Le prix de vente se calculait dans la route de synchronisation, à
 * partir d'une variable d'environnement. Deux endroits auraient suffi à
 * faire diverger la boutique et le back-office : tout passe désormais
 * par ce module, y compris l'aperçu affiché dans un formulaire.
 *
 * Isomorphe : utilisé par le serveur (import, application d'une marge)
 * et par le navigateur (aperçu « prix calculé » en direct).
 */

/** Bornes de saisie, reprises telles quelles par les contraintes en base. */
export const MARGIN_MIN = 0;
export const MARGIN_MAX = 1000;

/**
 * Précision de stockage : `numeric(18,5)`.
 *
 * Arrondir plus tôt ferait diverger le prix affiché et le prix débité
 * sur les services à très bas tarif — le catalogue en compte à
 * 0,00096 $ le millier.
 */
const PRICE_DECIMALS = 5;

export type MarginMode = 'global' | 'custom';

export type MarginSource = {
  margin_mode?: MarginMode | null;
  custom_margin?: number | null;
};

/**
 * Marge réellement appliquée à un service.
 *
 *   marge individuelle si définie, sinon marge globale
 *
 * `custom_margin` fait foi, pas `margin_mode` : le mode n'est que sa
 * traduction lisible. Une ligne incohérente — mode « custom » sans
 * valeur — retombe donc sur le global au lieu de produire un NaN.
 */
export function effectiveMargin(service: MarginSource, globalMargin: number): number {
  const custom = service?.custom_margin;

  if (service?.margin_mode === 'custom' && custom !== null && custom !== undefined) {
    const value = Number(custom);
    if (Number.isFinite(value)) return value;
  }

  const fallback = Number(globalMargin);
  return Number.isFinite(fallback) ? fallback : 0;
}

/** prix de vente = coût fournisseur x (1 + marge / 100) */
export function sellingPrice(providerRate: number, margin: number): number {
  const cost = Number(providerRate);
  const rate = Number(margin);

  if (!Number.isFinite(cost) || cost < 0) return 0;
  if (!Number.isFinite(rate)) return cost;

  const factor = 10 ** PRICE_DECIMALS;
  return Math.round(cost * (1 + rate / 100) * factor) / factor;
}

/** Prix d'un service, marges résolues. */
export function priceOf(
  service: MarginSource & { provider_rate: number },
  globalMargin: number
): number {
  return sellingPrice(service.provider_rate, effectiveMargin(service, globalMargin));
}

/**
 * Marge que représente un prix déjà fixé.
 *
 * Sert à convertir un ancien prix verrouillé, et à afficher la marge
 * effective d'un service dont le prix a été posé à la main.
 */
export function marginFromPrice(providerRate: number, price: number): number | null {
  const cost = Number(providerRate);
  if (!Number.isFinite(cost) || cost <= 0) return null;

  const value = Number(price);
  if (!Number.isFinite(value)) return null;

  return Math.round((value / cost - 1) * 100 * 100) / 100;
}

export type MarginValidation =
  | { ok: true; margin: number }
  | { ok: false; error: 'MARGIN_NOT_A_NUMBER' | 'MARGIN_OUT_OF_RANGE' };

/**
 * Contrôle d'une marge saisie.
 *
 * Refuse `NaN`, `null`, le texte et les valeurs négatives — une marge
 * négative vendrait à perte sans que rien ne le signale.
 */
export function validateMargin(input: unknown): MarginValidation {
  if (input === null || input === undefined || input === '') {
    return { ok: false, error: 'MARGIN_NOT_A_NUMBER' };
  }

  const margin = Number(input);
  if (!Number.isFinite(margin)) return { ok: false, error: 'MARGIN_NOT_A_NUMBER' };
  if (margin < MARGIN_MIN || margin > MARGIN_MAX) {
    return { ok: false, error: 'MARGIN_OUT_OF_RANGE' };
  }

  // Deux décimales : au-delà, l'affiché et le calculé divergent.
  return { ok: true, margin: Math.round(margin * 100) / 100 };
}

export const MARGIN_MESSAGE: Record<string, string> = {
  MARGIN_NOT_A_NUMBER: 'Enter a margin as a number.',
  MARGIN_OUT_OF_RANGE: `Margin must be between ${MARGIN_MIN} and ${MARGIN_MAX}%.`,
};
