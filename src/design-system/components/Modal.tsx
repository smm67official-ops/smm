'use client';

import { useEffect, useRef, type ReactNode } from 'react';
import Icon from '@/design-system/components/Icon';

export type ModalProps = {
  open: boolean;
  onClose: () => void;
  title: ReactNode;
  description?: ReactNode;
  children?: ReactNode;
  footer?: ReactNode;
  size?: 'sm' | 'md' | 'lg';
};

const MAX_WIDTH = { sm: 420, md: 520, lg: 720 };

export default function Modal({ open, onClose, title, description, children, footer, size = 'md' }: ModalProps) {
  const panelRef = useRef<HTMLDivElement>(null);

  /*
    `onClose` derrière une référence.

    L'effet ci-dessous en dépendait directement. Or l'appelant le
    redéfinit à chaque rendu (`onClose={() => …}`), donc l'effet se
    rejouait à chaque frappe : il redonnait le focus au panneau, et la
    saisie s'arrêtait après un caractère. Le passer par une référence
    garde le gestionnaire à jour sans réabonnement.
  */
  const onCloseRef = useRef(onClose);
  useEffect(() => {
    onCloseRef.current = onClose;
  });

  // Fermeture au clavier + verrouillage du défilement de la page.
  useEffect(() => {
    if (!open) return;

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCloseRef.current();
    };

    document.addEventListener('keydown', onKeyDown);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    return () => {
      document.removeEventListener('keydown', onKeyDown);
      document.body.style.overflow = previousOverflow;
    };
  }, [open]);

  /*
    Focus initial, une seule fois par ouverture.

    On vise le premier champ plutôt que le panneau : une boîte de
    dialogue de saisie sert à saisir, et l'utilisateur peut taper sans
    cliquer d'abord. À défaut de champ, le panneau reçoit le focus pour
    que la lecture d'écran commence au bon endroit et qu'Échap réponde.
  */
  useEffect(() => {
    if (!open) return;

    const panel = panelRef.current;
    if (!panel) return;

    const field = panel.querySelector<HTMLElement>(
      'input:not([type="hidden"]):not([disabled]), textarea:not([disabled]), select:not([disabled])'
    );

    (field ?? panel).focus();
  }, [open]);

  if (!open) return null;

  return (
    <div className="sv-modal" role="dialog" aria-modal="true" aria-label={typeof title === 'string' ? title : undefined}>
      <div className="sv-modal__backdrop" onClick={onClose} />
      <div
        ref={panelRef}
        tabIndex={-1}
        className="sv-modal__panel"
        style={{ maxWidth: MAX_WIDTH[size] }}
      >
        <div className="sv-modal__header">
          <div>
            <h3 className="sv-modal__title">{title}</h3>
            {description && <p className="sv-caption" style={{ margin: 'var(--sv-space-1) 0 0' }}>{description}</p>}
          </div>
          <button type="button" className="sv-modal__close" onClick={onClose} aria-label="Close">
            <Icon name="close" size={16} />
          </button>
        </div>

        {children && <div className="sv-modal__body">{children}</div>}
        {footer && <div className="sv-modal__footer">{footer}</div>}
      </div>
    </div>
  );
}
