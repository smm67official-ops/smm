'use client';

import type { ReactNode } from 'react';

/**
 * Bandeau défilant en boucle (CSS pur, pas de dépendance type Swiper).
 * Le contenu est dupliqué pour que la translation de -50 % soit invisible.
 */
export default function Marquee({
  children,
  speed = 40,
  reverse = false,
  className = '',
}: {
  children: ReactNode;
  speed?: number; // durée d'un cycle en secondes
  reverse?: boolean;
  className?: string;
}) {
  return (
    <div className={`tm-marquee ${className}`.trim()}>
      <div
        className={`tm-marquee-track${reverse ? ' is-reverse' : ''}`}
        style={{ animationDuration: `${speed}s` }}
      >
        <div className="tm-marquee-group">{children}</div>
        <div className="tm-marquee-group" aria-hidden="true">
          {children}
        </div>
      </div>
    </div>
  );
}
