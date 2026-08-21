'use client';

import { usePathname } from 'next/navigation';
import type { ReactNode } from 'react';
import { CX_ROUTE } from '@/components/layout/ClientChrome';

/**
 * Masque l'en-tête et le pied de page marketing sur les routes qui ont leur
 * propre habillage : l'administration (sv-admin) et l'espace client (cx).
 * Empiler deux barres d'en-tête coûtait un tiers de l'écran sur mobile.
 */
export default function SiteChrome({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  if (/\/admin(\/|$)/.test(pathname)) return null;
  if (CX_ROUTE.test(pathname)) return null;
  return <>{children}</>;
}
