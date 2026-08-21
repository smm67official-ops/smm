'use client';

import { useRef } from 'react';
import { useGsap } from '@/lib/motion/useGsap';
import { successPop } from '@/lib/motion/presets';

/**
 * Coche de confirmation.
 *
 * Le seul endroit où une animation « marquée » est justifiée : elle
 * signale qu'une action irréversible vient d'aboutir. Elle ne se répète
 * pas et ne boucle pas.
 */
export default function SuccessCheck() {
  const ref = useRef<HTMLSpanElement>(null);

  useGsap(() => {
    if (ref.current) successPop(ref.current);
  }, []);

  return (
    <span ref={ref} className="cx-success__check">
      <i className="ion-checkmark" />
    </span>
  );
}
