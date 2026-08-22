'use client';

import { useEffect, useRef } from 'react';
import { badgePop } from '@/lib/motion/presets';

/**
 * Pastille de comptage du panier.
 *
 * Elle réagit uniquement quand le nombre AUGMENTE : un retrait n'a pas à
 * être fêté, et rejouer l'animation à chaque rendu la rendrait nerveuse.
 * La valeur précédente est mémorisée dans une ref pour comparer sans
 * provoquer de rendu supplémentaire.
 */
export default function CartBadge({
  count,
  className = 'cx-iconbtn__dot',
  fallback = false,
}: {
  count: number;
  className?: string;
  /** Garder la pastille visible à zéro (en-tête du thème, où elle
      fait partie de la composition de l'icône). */
  fallback?: boolean;
}) {
  const ref = useRef<HTMLSpanElement>(null);
  const previous = useRef(count);

  useEffect(() => {
    if (count > previous.current) badgePop(ref.current);
    previous.current = count;
  }, [count]);

  if (count <= 0 && !fallback) return null;

  return (
    <span ref={ref} className={className} aria-live="polite">
      {count}
    </span>
  );
}
