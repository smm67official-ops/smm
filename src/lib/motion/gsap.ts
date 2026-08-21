'use client';

import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

/**
 * Point d'entrée GSAP unique.
 *
 * L'enregistrement des plugins doit avoir lieu exactement une fois et
 * seulement dans le navigateur : `ScrollTrigger` touche `window` au
 * moment de son installation.
 */
let registered = false;

if (typeof window !== 'undefined' && !registered) {
  registered = true;
  gsap.registerPlugin(ScrollTrigger);

  // Aucune animation ne doit laisser un élément dans un état intermédiaire
  // si le composant est démonté en cours de route.
  gsap.defaults({ overwrite: 'auto' });
}

export { gsap, ScrollTrigger };
