'use client';

import { useState } from 'react';
import { buildWhatsAppLink } from '@/lib/whatsapp';

/**
 * Ouvre WhatsApp avec un message pré-rempli et journalise l'événement.
 *
 * Le clic n'a AUCUN effet sur la commande : il n'en crée pas de seconde,
 * ne redébite pas le portefeuille et ne change pas le statut. La route
 * appelée n'écrit qu'une ligne `order_events`.
 */
export default function WhatsAppButton({
  orderId,
  phone,
  message,
  label,
  unavailableLabel = 'WhatsApp number not configured',
  block = false,
  variant = 'whatsapp',
}: {
  orderId: string;
  phone: string;
  message: string;
  label: string;
  unavailableLabel?: string;
  block?: boolean;
  variant?: 'whatsapp' | 'outline';
}) {
  const [logged, setLogged] = useState(false);
  const link = buildWhatsAppLink(phone, message);

  if (!link) {
    return (
      <span className="tm-whatsapp-btn is-disabled" aria-disabled="true">
        <i className="ion-social-whatsapp" /> {unavailableLabel}
      </span>
    );
  }

  const onClick = () => {
    // Journalisation au mieux : elle ne doit jamais retarder l'ouverture.
    if (logged) return;
    setLogged(true);
    void fetch(`/api/orders/${orderId}/whatsapp`, { method: 'POST' }).catch(() => {});
  };

  return (
    <a
      href={link}
      target="_blank"
      rel="noreferrer noopener"
      onClick={onClick}
      className={[
        'tm-whatsapp-btn',
        variant === 'outline' && 'tm-whatsapp-btn-outline',
        block && 'tm-whatsapp-btn-block',
      ]
        .filter(Boolean)
        .join(' ')}
    >
      <i className="ion-social-whatsapp" />
      {label}
    </a>
  );
}
