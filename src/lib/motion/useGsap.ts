'use client';

import { useLayoutEffect, useRef, type DependencyList, type RefObject } from 'react';
import { gsap } from '@/lib/motion/gsap';

/**
 * `gsap.context()` encapsulé dans un effet React.
 *
 * Le contexte mémorise tout ce que la fonction crée (tweens, timelines,
 * ScrollTriggers) et `revert()` remet le DOM dans son état initial au
 * démontage. Sans cela, une navigation laisse des ScrollTriggers actifs
 * qui écoutent le scroll d'une page qui n'existe plus.
 */
export function useGsap(
  effect: (context: gsap.Context) => void,
  deps: DependencyList = [],
  scope?: RefObject<HTMLElement | null>
) {
  useLayoutEffect(() => {
    const context = gsap.context((self) => effect(self), scope?.current ?? undefined);
    return () => context.revert();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
}

/**
 * Variante avec portée : renvoie la ref à poser sur le conteneur.
 * Les sélecteurs passés à GSAP sont alors résolus dans ce sous-arbre.
 */
export function useGsapScope<T extends HTMLElement = HTMLDivElement>(
  effect: (context: gsap.Context) => void,
  deps: DependencyList = []
) {
  const ref = useRef<T>(null);
  useGsap(effect, deps, ref);
  return ref;
}
