'use client';

import { gsap } from '@/lib/motion/gsap';
import { EASE, distance, duration, stagger } from '@/lib/motion/config';

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
