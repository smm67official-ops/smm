'use client';

import { usePathname, useSearchParams } from 'next/navigation';
import { useEffect, useState } from 'react';

/**
 * Transition entre pages (§14).
 *
 * L'App Router n'expose pas encore de signal « navigation en cours » sur
 * cette version (`useLinkStatus` arrive plus tard). On écoute donc les
 * clics sur les liens internes en phase de capture : c'est le seul
 * moment où l'on sait qu'une navigation démarre, avant que React ne
 * suspende le rendu de la nouvelle page.
 *
 * La barre n'apparaît qu'au-delà d'un court délai : sur une page déjà en
 * cache, la navigation est instantanée et un éclair de barre serait plus
 * dérangeant qu'utile.
 */
const SHOW_AFTER = 140;
const SAFETY_TIMEOUT = 8000;

export default function RouteProgress() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [busy, setBusy] = useState(false);

  // L'arrivée sur la nouvelle URL clôt la transition.
  useEffect(() => {
    setBusy(false);
  }, [pathname, searchParams]);

  useEffect(() => {
    let showTimer: number | undefined;
    let safetyTimer: number | undefined;

    const onClick = (event: MouseEvent) => {
      // Clic modifié, secondaire ou avec touche : le navigateur gère.
      if (event.defaultPrevented || event.button !== 0) return;
      if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;

      const anchor = (event.target as HTMLElement | null)?.closest('a');
      if (!anchor) return;

      const href = anchor.getAttribute('href');
      if (!href || href.startsWith('#')) return;
      if (anchor.target && anchor.target !== '_self') return;
      if (anchor.hasAttribute('download')) return;

      let url: URL;
      try {
        url = new URL(anchor.href, window.location.href);
      } catch {
        return;
      }

      // Lien externe, ou même page : aucune navigation à annoncer.
      if (url.origin !== window.location.origin) return;
      if (url.href === window.location.href) return;

      showTimer = window.setTimeout(() => setBusy(true), SHOW_AFTER);

      // Filet : une navigation annulée ne doit pas laisser la barre à vie.
      safetyTimer = window.setTimeout(() => setBusy(false), SAFETY_TIMEOUT);
    };

    document.addEventListener('click', onClick, true);
    return () => {
      document.removeEventListener('click', onClick, true);
      window.clearTimeout(showTimer);
      window.clearTimeout(safetyTimer);
    };
  }, [pathname]);

  if (!busy) return null;

  return <div className="mx-progress" role="presentation" aria-hidden="true" />;
}
