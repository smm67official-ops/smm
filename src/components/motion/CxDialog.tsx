'use client';

import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { modalClose, modalOpen, sheetClose, sheetOpen } from '@/lib/motion/presets';

/**
 * Boîte de dialogue de l'espace client.
 *
 * Rendue dans un portail sur <body> : montée là où elle est appelée,
 * elle héritait du contexte d'empilement de son conteneur et se
 * retrouvait peinte sous le contenu de la page.
 *
 * Feuille glissée depuis le bas sous 640px (le pouce est en bas de
 * l'écran), boîte centrée au-dessus. La fermeture rejoue exactement
 * l'ouverture à l'envers : un mouvement qui ne se referme pas par le
 * même chemin donne l'impression que l'élément « saute ».
 */
export default function CxDialog({
  open,
  onClose,
  title,
  description,
  children,
  footer,
  labelledBy = 'cx-dialog-title',
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
  labelledBy?: string;
}) {
  /** Reste monté le temps de l'animation de sortie. */
  const [mounted, setMounted] = useState(open);
  const overlayRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const restoreFocus = useRef<HTMLElement | null>(null);

  const isSheet = () =>
    typeof window !== 'undefined' && window.matchMedia('(max-width: 639px)').matches;

  useEffect(() => {
    if (open) setMounted(true);
  }, [open]);

  // Ouverture
  useEffect(() => {
    if (!open || !mounted) return;
    const overlay = overlayRef.current;
    const panel = panelRef.current;
    if (!overlay || !panel) return;

    restoreFocus.current = document.activeElement as HTMLElement | null;

    const timeline = isSheet() ? sheetOpen(overlay, panel) : modalOpen(overlay, panel);

    // Le focus part sur le panneau : le lecteur d'écran annonce le titre
    // et la tabulation reste dans la boîte.
    panel.focus({ preventScroll: true });

    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    return () => {
      timeline.kill();
      document.body.style.overflow = previous;
    };
  }, [open, mounted]);

  // Fermeture animée
  useEffect(() => {
    if (open || !mounted) return;
    const overlay = overlayRef.current;
    const panel = panelRef.current;

    if (!overlay || !panel) {
      setMounted(false);
      return;
    }

    const done = () => {
      setMounted(false);
      restoreFocus.current?.focus?.({ preventScroll: true });
    };

    const timeline = isSheet()
      ? sheetClose(overlay, panel, done)
      : modalClose(overlay, panel, done);

    return () => {
      timeline.kill();
    };
  }, [open, mounted]);

  const onKeyDown = useCallback(
    (event: React.KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.stopPropagation();
        onClose();
        return;
      }

      // Piège à focus : la tabulation boucle dans le panneau.
      if (event.key !== 'Tab') return;

      const panel = panelRef.current;
      if (!panel) return;

      const focusables = panel.querySelectorAll<HTMLElement>(
        'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
      );
      if (!focusables.length) return;

      const first = focusables[0];
      const last = focusables[focusables.length - 1];

      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    },
    [onClose]
  );

  if (!mounted || typeof document === 'undefined') return null;

  return createPortal(
    <div className="cx-dialog" onKeyDown={onKeyDown}>
      <div
        ref={overlayRef}
        className="cx-dialog__overlay"
        role="presentation"
        onClick={onClose}
      />

      <div
        ref={panelRef}
        className="cx-dialog__panel"
        role="dialog"
        aria-modal="true"
        aria-labelledby={labelledBy}
        tabIndex={-1}
      >
        <span className="cx-dialog__grip" aria-hidden="true" />

        <header className="cx-dialog__head">
          <div>
            <h2 id={labelledBy}>{title}</h2>
            {description && <p>{description}</p>}
          </div>
          <button type="button" className="cx-dialog__close" aria-label="Fermer" onClick={onClose}>
            <i className="ion-close" />
          </button>
        </header>

        <div className="cx-dialog__body">{children}</div>

        {footer && <footer className="cx-dialog__foot">{footer}</footer>}
      </div>
    </div>,
    document.body
  );
}
