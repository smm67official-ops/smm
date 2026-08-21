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

  // Fermeture au clavier + verrouillage du défilement de la page.
  useEffect(() => {
    if (!open) return;

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };

    document.addEventListener('keydown', onKeyDown);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    panelRef.current?.focus();

    return () => {
      document.removeEventListener('keydown', onKeyDown);
      document.body.style.overflow = previousOverflow;
    };
  }, [open, onClose]);

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
