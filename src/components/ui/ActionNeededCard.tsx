import Link from 'next/link';
import type { ReactNode } from 'react';

export type MissingItem = { label: string; done?: boolean };

/**
 * Bloc « informations nécessaires ».
 *
 * Remplace le message d'erreur brut : on explique ce qui manque et on
 * propose une action évidente. Le bouton WhatsApp n'apparaît que si la
 * complétion passe réellement par ce canal.
 */
export default function ActionNeededCard({
  title,
  description,
  items = [],
  primaryLabel,
  primaryHref,
  whatsappLabel,
  whatsappHref,
  children,
}: {
  title: string;
  description: string;
  items?: MissingItem[];
  primaryLabel?: string;
  primaryHref?: string;
  whatsappLabel?: string;
  whatsappHref?: string | null;
  children?: ReactNode;
}) {
  return (
    <section className="cx-action-card">
      <div className="cx-action-card__head">
        <span className="cx-action-card__icon">
          <i className="ion-information" />
        </span>
        <div>
          <h3>{title}</h3>
          <p>{description}</p>
        </div>
      </div>

      {items.length > 0 && (
        <ul className="cx-action-card__list">
          {items.map((item) => (
            <li key={item.label}>
              <i className={item.done ? 'ion-checkmark-circled' : 'ion-record'} />
              {item.label}
            </li>
          ))}
        </ul>
      )}

      <div className="cx-action-card__actions">
        {primaryHref && primaryLabel && (
          <Link href={primaryHref} className="cx-btn cx-btn--primary">
            {primaryLabel}
            <i className="ion-arrow-right-c" />
          </Link>
        )}

        {whatsappHref && whatsappLabel && (
          <a
            href={whatsappHref}
            target="_blank"
            rel="noreferrer noopener"
            className="cx-btn cx-btn--whatsapp"
          >
            <i className="ion-social-whatsapp" />
            {whatsappLabel}
          </a>
        )}

        {children}
      </div>
    </section>
  );
}
