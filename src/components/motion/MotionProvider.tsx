'use client';

import { usePathname } from 'next/navigation';
import { useEffect, useLayoutEffect, useRef, type ReactNode } from 'react';
import { gsap, ScrollTrigger } from '@/lib/motion/gsap';
import { EASE, distance, duration, prefersReducedMotion, stagger } from '@/lib/motion/config';
import { pageEnter, pressFeedback } from '@/lib/motion/presets';

/*
  Le placement de l'état initial doit précéder la peinture, sinon le
  contenu apparaît puis disparaît à chaque navigation. `useLayoutEffect`
  n'existe pas au rendu serveur : on retombe sur `useEffect`, qui n'y est
  de toute façon jamais exécuté.
*/
const useIsomorphicLayoutEffect = typeof window !== 'undefined' ? useLayoutEffect : useEffect;

/**
 * Chef d'orchestre du mouvement.
 *
 * Trois responsabilités, regroupées ici pour qu'il n'y ait qu'un seul
 * `gsap.context()` à nettoyer par navigation :
 *
 *  1. entrée de page       — `[data-motion="head|body|item"]`
 *  2. révélation au scroll — `[data-reveal]`
 *  3. retour de pression   — `[data-press]`
 *
 * Les composants n'importent pas GSAP : ils posent un attribut. C'est ce
 * qui garde le langage de mouvement identique d'un écran à l'autre.
 */
export default function MotionProvider({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const scope = useRef<HTMLDivElement>(null);

  useIsomorphicLayoutEffect(() => {
    const root = scope.current;
    if (!root) return;

    /*
      `html.has-motion` est posée par un script en ligne (voir le layout) et
      masque en CSS ce qui doit entrer en scène — sinon le contenu rendu par
      le serveur clignote entre la peinture initiale et l'hydratation.
      Une fois GSAP passé, les styles en ligne prennent le relais et la
      classe n'a plus de raison d'être : si ce code ne s'exécutait jamais,
      elle resterait et le contenu serait invisible. On la retire donc dès
      que la scène est posée, y compris en mode « mouvement réduit ».
    */
    const release = () => document.documentElement.classList.remove('has-motion');

    if (prefersReducedMotion()) {
      release();
      return;
    }

    const context = gsap.context(() => {
      pageEnter(root);

      /*
        Blocs du thème marketing. Ils portaient leur propre observateur
        d'intersection ; le passer sous GSAP aligne leur courbe et leur
        durée sur le reste du produit, au lieu d'un `fadeIn 1s` isolé.
      */
      gsap.utils.toArray<HTMLElement>('.tm-scrollanim', root).forEach((element) => {
        gsap.fromTo(
          element,
          { autoAlpha: 0, y: distance('md') },
          {
            autoAlpha: 1,
            y: 0,
            duration: duration('normal'),
            ease: EASE.enter,
            scrollTrigger: { trigger: element, start: 'top 90%', once: true },
          }
        );
      });

      // Révélation au scroll : ce qui arrive sous la ligne de flottaison.
      gsap.utils.toArray<HTMLElement>('[data-reveal]', root).forEach((element) => {
        const children = element.querySelectorAll<HTMLElement>('[data-reveal-item]');
        const targets = children.length ? children : [element];

        gsap.fromTo(
          targets,
          { autoAlpha: 0, y: distance('md') },
          {
            autoAlpha: 1,
            y: 0,
            duration: duration('normal'),
            ease: EASE.enter,
            stagger: children.length ? stagger('normal') : 0,
            scrollTrigger: { trigger: element, start: 'top 88%', once: true },
          }
        );
      });

      /*
        Filet : un `data-reveal-item` posé hors d'un groupe `data-reveal`
        serait masqué par la feuille de style et jamais réanimé. Plutôt
        que d'exiger un balisage parfait, on lui donne sa propre entrée.
      */
      gsap.utils
        .toArray<HTMLElement>('[data-reveal-item]', root)
        .filter((element) => !element.closest('[data-reveal]'))
        .forEach((element) => {
          gsap.fromTo(
            element,
            { autoAlpha: 0, y: distance('md') },
            {
              autoAlpha: 1,
              y: 0,
              duration: duration('normal'),
              ease: EASE.enter,
              scrollTrigger: { trigger: element, start: 'top 92%', once: true },
            }
          );
        });
    }, root);

    release();

    /*
      Retour de pression, délégué : un seul écouteur pour toute la page.
      Les trois familles de boutons du produit sont couvertes d'office —
      c'est ce qui garantit que l'appui donne la même sensation dans la
      boutique, l'espace client et l'administration, sans avoir à annoter
      chaque bouton. `data-press="off"` permet de s'en exclure.
    */
    const PRESSABLE = '[data-press], .cx-btn, .gp-btn, .tm-button, .cx-amount, .cx-iconbtn';

    const onPointerDown = (event: PointerEvent) => {
      const target = (event.target as HTMLElement | null)?.closest<HTMLElement>(PRESSABLE);
      if (!target || target.hasAttribute('disabled')) return;
      if (target.getAttribute('data-press') === 'off') return;
      pressFeedback(target);
    };
    root.addEventListener('pointerdown', onPointerDown);

    // Les hauteurs bougent après le chargement des polices et des images.
    const refresh = window.setTimeout(() => ScrollTrigger.refresh(), 260);

    return () => {
      window.clearTimeout(refresh);
      root.removeEventListener('pointerdown', onPointerDown);
      context.revert();
    };
  }, [pathname]);

  return (
    <div ref={scope} data-motion-root>
      {children}
    </div>
  );
}
