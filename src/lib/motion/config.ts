/**
 * Configuration centrale du mouvement.
 *
 * Une seule source de vérité pour les durées, les courbes et les
 * distances : c'est ce qui fait qu'une modale, une carte et un toast
 * donnent l'impression d'appartenir au même produit.
 *
 * Règle : on n'anime que `transform` et `opacity`. Ces deux propriétés
 * sont composées par le GPU et ne déclenchent ni layout ni paint.
 */

/** Durées, en secondes (unité GSAP). */
export const DURATION = {
  /** Retour immédiat : pression, bascule, survol. */
  fast: 0.18,
  /** Cas courant : apparition d'élément, changement d'état. */
  normal: 0.32,
  /** Moment fort : modale, page, confirmation. */
  emphasis: 0.46,
} as const;

/**
 * Courbes.
 * `out` partout : le mouvement démarre vite et se pose — c'est ce qui
 * donne la sensation de réactivité. Les `inOut` sont réservés aux
 * sorties, où l'on veut au contraire une reprise en main douce.
 */
export const EASE = {
  /** Entrées d'éléments. */
  enter: 'power3.out',
  /** Sorties. */
  exit: 'power2.in',
  /** Interactions directes (pression, bascule). */
  snap: 'power2.out',
  /** Moments forts : modale, succès. */
  emphasis: 'expo.out',
} as const;

/** Décalages de départ, en pixels. Volontairement courts. */
export const DISTANCE = {
  sm: 8,
  md: 16,
  lg: 28,
} as const;

/** Intervalle entre deux éléments d'une même série. */
export const STAGGER = {
  tight: 0.04,
  normal: 0.06,
  loose: 0.09,
} as const;

/** Nombre d'éléments au-delà duquel on cesse d'échelonner. */
export const STAGGER_MAX = 12;

/**
 * L'utilisateur a demandé moins d'animation (OS ou navigateur).
 * On ne supprime pas le retour visuel : on le rend instantané.
 */
export function prefersReducedMotion(): boolean {
  if (typeof window === 'undefined') return false;
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

/** Sous 768px on raccourcit : l'écran est plus petit, l'attente pèse plus. */
export function isCompactViewport(): boolean {
  if (typeof window === 'undefined') return false;
  return window.matchMedia('(max-width: 767px)').matches;
}

/**
 * Durée effective : 0 si le mouvement est refusé, réduite sur mobile.
 * À utiliser partout plutôt que les constantes brutes.
 */
export function duration(key: keyof typeof DURATION): number {
  if (prefersReducedMotion()) return 0;
  const base = DURATION[key];
  return isCompactViewport() ? base * 0.75 : base;
}

/** Distance effective : plus courte sur mobile, nulle sans mouvement. */
export function distance(key: keyof typeof DISTANCE): number {
  if (prefersReducedMotion()) return 0;
  const base = DISTANCE[key];
  return isCompactViewport() ? Math.round(base * 0.6) : base;
}

/** Échelonnement effectif, plafonné pour ne jamais faire attendre. */
export function stagger(key: keyof typeof STAGGER = 'normal'): number {
  if (prefersReducedMotion()) return 0;
  return isCompactViewport() ? STAGGER[key] * 0.7 : STAGGER[key];
}
