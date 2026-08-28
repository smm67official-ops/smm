'use client';

import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import { buildWhatsAppLink } from '@/lib/whatsapp';

/**
 * Bouton WhatsApp flottant, présent sur tout le site.
 *
 * Monté une seule fois dans le layout : aucune page ne le déclare, donc
 * aucune page ne peut l'oublier ni le dupliquer.
 *
 * Le numéro et la configuration viennent d'Admin -> Parameters, résolus
 * côté serveur. Rien n'est écrit en dur ici : si le composant ne reçoit
 * pas de numéro, il ne s'affiche pas.
 */
export default function WhatsAppWidget({
  number,
  message,
  greeting,
  position,
}: {
  number: string;
  message: string;
  greeting: string | null;
  position: 'bottom-right' | 'bottom-left';
}) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  /*
    L'espace d'administration et le tunnel de commande en sont exclus.

    Un bouton flottant y recouvrirait des actions — le total du panier,
    les boutons d'un tableau — et l'administrateur qui gère le panel n'a
    pas besoin de s'écrire à lui-même.
  */
  const hidden = /\/admin(\/|$)|\/checkout(\/|$)|\/cart(\/|$)/.test(pathname ?? '');

  // La bulle se referme au changement de page : la laisser ouverte
  // masquerait le haut de l'écran suivant.
  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  if (hidden || !number) return null;

  const href = buildWhatsAppLink(number, message);
  if (!href) return null;

  return (
    <div className={`wa-widget wa-widget--${position}`} data-open={open || undefined}>
      {greeting && open && (
        <div className="wa-widget__bubble" role="status">
          <button
            type="button"
            className="wa-widget__close"
            onClick={() => setOpen(false)}
            aria-label="Close"
          >
            ×
          </button>
          <p>{greeting}</p>
          <a href={href} target="_blank" rel="noreferrer noopener" className="wa-widget__cta">
            WhatsApp
          </a>
        </div>
      )}

      {/*
        Sans message d'accueil, le bouton ouvre WhatsApp directement :
        une bulle vide n'ajouterait qu'un clic. Avec un message, le
        premier clic la déplie.
      */}
      {greeting && !open ? (
        <button
          type="button"
          className="wa-widget__button"
          onClick={() => setOpen(true)}
          aria-label="WhatsApp"
        >
          <WhatsAppIcon />
        </button>
      ) : greeting ? null : (
        <a
          href={href}
          target="_blank"
          rel="noreferrer noopener"
          className="wa-widget__button"
          aria-label="WhatsApp"
        >
          <WhatsAppIcon />
        </a>
      )}
    </div>
  );
}

function WhatsAppIcon() {
  return (
    <svg viewBox="0 0 24 24" width="28" height="28" fill="currentColor" aria-hidden="true">
      <path d="M17.47 14.38c-.3-.15-1.75-.86-2.02-.96-.27-.1-.47-.15-.67.15-.2.3-.77.96-.94 1.16-.17.2-.35.22-.64.08-.3-.15-1.25-.46-2.38-1.47-.88-.78-1.47-1.75-1.64-2.05-.17-.3-.02-.46.13-.6.13-.13.3-.35.45-.52.15-.17.2-.3.3-.5.1-.2.05-.37-.02-.52-.08-.15-.67-1.6-.92-2.2-.24-.58-.49-.5-.67-.51h-.57c-.2 0-.52.07-.79.37-.27.3-1.04 1.01-1.04 2.47 0 1.46 1.06 2.87 1.21 3.07.15.2 2.1 3.2 5.08 4.49.71.3 1.26.49 1.69.63.71.22 1.36.19 1.87.12.57-.09 1.75-.72 2-1.41.25-.69.25-1.28.17-1.41-.07-.13-.27-.2-.57-.35z" />
      <path d="M12.04 2C6.58 2 2.13 6.45 2.13 11.91c0 1.75.46 3.45 1.32 4.95L2 22l5.25-1.38a9.9 9.9 0 0 0 4.79 1.22h.01c5.46 0 9.9-4.45 9.9-9.91C21.95 6.45 17.5 2 12.04 2zm0 18.15h-.01a8.2 8.2 0 0 1-4.19-1.15l-.3-.18-3.12.82.83-3.04-.2-.31a8.22 8.22 0 0 1-1.26-4.38c0-4.54 3.7-8.23 8.25-8.23 2.2 0 4.27.86 5.83 2.42a8.19 8.19 0 0 1 2.41 5.82c0 4.54-3.7 8.23-8.24 8.23z" />
    </svg>
  );
}
