'use client';

import { gsap } from '@/lib/motion/gsap';
import { EASE, distance, duration, prefersReducedMotion, stagger } from '@/lib/motion/config';

/**
 * Animations réutilisables.
 *
 * Chaque fonction renvoie un `gsap.core.Tween | Timeline` et se contente
 * de `transform` / `opacity`. Elles sont conçues pour être appelées
 * depuis un `gsap.context()` — voir `useGsap`.
 */

type Target = gsap.TweenTarget;

/** Apparition avec léger déplacement vers le haut. */
export function fadeUp(target: Target, options: { delay?: number; distance?: number } = {}) {
  return gsap.fromTo(
    target,
    { autoAlpha: 0, y: options.distance ?? distance('md') },
    {
      autoAlpha: 1,
      y: 0,
      duration: duration('normal'),
      ease: EASE.enter,
      delay: options.delay ?? 0,
    }
  );
}

/** Apparition sans déplacement — pour ce qui ne doit pas bouger. */
export function fadeIn(target: Target, options: { delay?: number } = {}) {
  return gsap.fromTo(
    target,
    { autoAlpha: 0 },
    { autoAlpha: 1, duration: duration('normal'), ease: EASE.enter, delay: options.delay ?? 0 }
  );
}

/** Apparition avec agrandissement : réservée aux confirmations. */
export function scaleIn(target: Target, options: { delay?: number } = {}) {
  return gsap.fromTo(
    target,
    { autoAlpha: 0, scale: 0.9 },
    {
      autoAlpha: 1,
      scale: 1,
      duration: duration('emphasis'),
      ease: EASE.emphasis,
      delay: options.delay ?? 0,
    }
  );
}

/** Série d'éléments qui se posent l'un après l'autre. */
export function staggerUp(
  targets: Target,
  options: { delay?: number; amount?: 'tight' | 'normal' | 'loose' } = {}
) {
  return gsap.fromTo(
    targets,
    { autoAlpha: 0, y: distance('sm') },
    {
      autoAlpha: 1,
      y: 0,
      duration: duration('normal'),
      ease: EASE.enter,
      delay: options.delay ?? 0,
      stagger: stagger(options.amount ?? 'normal'),
    }
  );
}

/**
 * Entrée de page : en-tête, puis contenu, puis cartes.
 * Les cibles absentes sont ignorées — la même séquence sert partout.
 */
export function pageEnter(scope: HTMLElement | null) {
  if (!scope) return null;

  const head = scope.querySelectorAll('[data-motion="head"]');
  const body = scope.querySelectorAll('[data-motion="body"]');
  const items = scope.querySelectorAll('[data-motion="item"]');

  const timeline = gsap.timeline();

  if (head.length) {
    timeline.fromTo(
      head,
      { autoAlpha: 0, y: distance('sm') },
      { autoAlpha: 1, y: 0, duration: duration('normal'), ease: EASE.enter }
    );
  }

  if (body.length) {
    timeline.fromTo(
      body,
      { autoAlpha: 0, y: distance('md') },
      { autoAlpha: 1, y: 0, duration: duration('normal'), ease: EASE.enter },
      head.length ? '-=0.22' : 0
    );
  }

  if (items.length) {
    timeline.fromTo(
      items,
      { autoAlpha: 0, y: distance('sm') },
      {
        autoAlpha: 1,
        y: 0,
        duration: duration('normal'),
        ease: EASE.enter,
        stagger: stagger('normal'),
      },
      '-=0.24'
    );
  }

  return timeline;
}

/** Ouverture de modale : voile puis panneau. */
export function modalOpen(overlay: HTMLElement, panel: HTMLElement) {
  const timeline = gsap.timeline();

  timeline.fromTo(overlay, { autoAlpha: 0 }, { autoAlpha: 1, duration: duration('fast') });
  timeline.fromTo(
    panel,
    { autoAlpha: 0, scale: 0.96, y: distance('sm') },
    { autoAlpha: 1, scale: 1, y: 0, duration: duration('emphasis'), ease: EASE.emphasis },
    '-=0.08'
  );

  return timeline;
}

/** Fermeture de modale : exactement l'inverse, en plus rapide. */
export function modalClose(overlay: HTMLElement, panel: HTMLElement, onDone: () => void) {
  const timeline = gsap.timeline({ onComplete: onDone });

  timeline.to(panel, {
    autoAlpha: 0,
    scale: 0.97,
    y: distance('sm'),
    duration: duration('fast'),
    ease: EASE.exit,
  });
  timeline.to(overlay, { autoAlpha: 0, duration: duration('fast') }, '-=0.1');

  return timeline;
}

/** Feuille glissée depuis le bas — variante mobile de la modale. */
export function sheetOpen(overlay: HTMLElement, panel: HTMLElement) {
  const timeline = gsap.timeline();

  timeline.fromTo(overlay, { autoAlpha: 0 }, { autoAlpha: 1, duration: duration('fast') });
  timeline.fromTo(
    panel,
    { yPercent: 100 },
    { yPercent: 0, duration: duration('emphasis'), ease: EASE.emphasis },
    '-=0.08'
  );

  return timeline;
}

export function sheetClose(overlay: HTMLElement, panel: HTMLElement, onDone: () => void) {
  const timeline = gsap.timeline({ onComplete: onDone });

  timeline.to(panel, { yPercent: 100, duration: duration('normal'), ease: EASE.exit });
  timeline.to(overlay, { autoAlpha: 0, duration: duration('fast') }, '-=0.16');

  return timeline;
}

/** Tiroir latéral : respecte le sens de lecture. */
export function drawerOpen(panel: HTMLElement, rtl = false) {
  return gsap.fromTo(
    panel,
    { xPercent: rtl ? 100 : -100 },
    { xPercent: 0, duration: duration('emphasis'), ease: EASE.emphasis }
  );
}

/** Entrée d'un toast : depuis le bas, sans déplacer le reste. */
export function toastIn(target: Target) {
  return gsap.fromTo(
    target,
    { autoAlpha: 0, y: distance('lg'), scale: 0.98 },
    { autoAlpha: 1, y: 0, scale: 1, duration: duration('normal'), ease: EASE.emphasis }
  );
}

export function toastOut(target: Target, onDone: () => void) {
  return gsap.to(target, {
    autoAlpha: 0,
    y: distance('sm'),
    scale: 0.98,
    duration: duration('fast'),
    ease: EASE.exit,
    onComplete: onDone,
  });
}

/**
 * Pression sur un bouton : 1 → 0.97 → 1.
 * Le retour tactile est ce qui distingue un bouton « vivant » d'une
 * zone cliquable inerte.
 */
export function pressFeedback(target: HTMLElement) {
  return gsap
    .timeline()
    .to(target, { scale: 0.97, duration: 0.08, ease: EASE.snap })
    .to(target, { scale: 1, duration: 0.16, ease: 'back.out(2)' });
}

/** Confirmation discrète : la coche se pose. */
export function successPop(target: Target) {
  return gsap.fromTo(
    target,
    { scale: 0.4, autoAlpha: 0 },
    { scale: 1, autoAlpha: 1, duration: duration('emphasis'), ease: 'back.out(1.7)' }
  );
}

/** Compteur animé — le solde « monte » jusqu'à sa valeur. */
export function countUp(
  target: HTMLElement,
  value: number,
  format: (n: number) => string,
  options: { delay?: number } = {}
) {
  const state = { n: 0 };

  if (duration('emphasis') === 0) {
    target.textContent = format(value);
    return null;
  }

  return gsap.to(state, {
    n: value,
    duration: 0.7,
    ease: 'power2.out',
    delay: options.delay ?? 0,
    onUpdate: () => {
      target.textContent = format(state.n);
    },
    onComplete: () => {
      target.textContent = format(value);
    },
  });
}

/* =========================================================
   Boutique — retours visuels d'ajout et de favori
   ========================================================= */

/** Cible du vol vers le panier, visible à l'écran, ou null. */
function cartTarget(): HTMLElement | null {
  const candidates = [
    '.cx-bottomnav__item[href*="/cart"]',
    '.cx-appbar .cx-iconbtn[aria-label]',
    '.tm-header-icons a[href*="/cart"]',
  ];

  for (const selector of candidates) {
    const element = document.querySelector<HTMLElement>(selector);
    if (!element) continue;
    const rect = element.getBoundingClientRect();
    // Un élément masqué (barre basse sur desktop) a une boîte nulle.
    if (rect.width > 0 && rect.height > 0) return element;
  }
  return null;
}

/**
 * « Vol vers le panier ».
 *
 * Un clone de la vignette part de sa position, décrit une courbe et se
 * réduit sur l'icône du panier. Le clone est en `position: fixed` et
 * hors flux : il ne déplace jamais la mise en page.
 *
 * Si aucune icône de panier n'est visible — cas du desktop où la barre
 * basse est masquée — on renvoie `false` et l'appelant se rabat sur un
 * retour local (bouton en succès). Forcer une trajectoire vers une cible
 * invisible enverrait la vignette dans un coin au hasard.
 */
export function flyToCart(source: HTMLElement | null): boolean {
  if (!source || prefersReducedMotion()) return false;

  const target = cartTarget();
  if (!target) return false;

  const from = source.getBoundingClientRect();
  const to = target.getBoundingClientRect();
  if (from.width === 0 || from.height === 0) return false;

  const clone = source.cloneNode(true) as HTMLElement;
  clone.style.cssText = `
    position: fixed;
    left: ${from.left}px;
    top: ${from.top}px;
    width: ${from.width}px;
    height: ${from.height}px;
    margin: 0;
    border-radius: 14px;
    object-fit: cover;
    pointer-events: none;
    z-index: 200;
    will-change: transform, opacity;
  `;
  document.body.appendChild(clone);

  const dx = to.left + to.width / 2 - (from.left + from.width / 2);
  const dy = to.top + to.height / 2 - (from.top + from.height / 2);

  gsap
    .timeline({ onComplete: () => clone.remove() })
    // Léger élan vers le haut avant de plonger : une ligne droite
    // paraît mécanique, l'arc se lit comme un geste.
    .to(clone, { x: dx * 0.45, y: dy * 0.28 - 42, duration: 0.28, ease: 'power2.out' })
    .to(clone, {
      x: dx,
      y: dy,
      scale: 0.12,
      autoAlpha: 0.35,
      duration: 0.42,
      ease: 'power2.in',
    });

  return true;
}

/** La pastille du panier accuse réception : 1 → 1.25 → 1. */
export function badgePop(target: HTMLElement | null) {
  if (!target || prefersReducedMotion()) return null;
  return gsap
    .timeline()
    .to(target, { scale: 1.25, duration: 0.14, ease: 'power2.out' })
    .to(target, { scale: 1, duration: 0.28, ease: 'elastic.out(1, 0.5)' });
}

/**
 * Bascule du cœur.
 * À l'ajout : léger dépassement d'échelle. Au retrait : simple retour,
 * sans célébration — on ne fête pas une suppression.
 */
export function favoriteToggle(target: HTMLElement | null, favorited: boolean) {
  if (!target || prefersReducedMotion()) return null;

  if (!favorited) {
    return gsap.fromTo(
      target,
      { scale: 0.85 },
      { scale: 1, duration: 0.26, ease: 'power2.out' }
    );
  }

  return gsap
    .timeline()
    .to(target, { scale: 0.8, duration: 0.09, ease: 'power2.in' })
    .to(target, { scale: 1.3, duration: 0.16, ease: 'power2.out' })
    .to(target, { scale: 1, duration: 0.3, ease: 'elastic.out(1, 0.45)' });
}
