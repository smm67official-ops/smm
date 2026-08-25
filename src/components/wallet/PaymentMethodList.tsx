'use client';

import Image from 'next/image';
import { useState } from 'react';
import type { PaymentMethod } from '@/lib/supabase/types';
import type { Dictionary } from '@/i18n';

/**
 * Moyens de paiement proposés au client pour recharger son portefeuille.
 *
 * La liste vient entièrement du back-office : ni nom, ni numéro, ni RIB
 * n'est écrit ici. Un moyen désactivé n'atteint jamais ce composant, le
 * filtre est appliqué côté serveur.
 *
 * Chaque coordonnée est copiable d'un geste : elle sera recopiée dans une
 * application bancaire, et un RIB de 24 chiffres retapé à la main se
 * trompe.
 */
export default function PaymentMethodList({
  methods,
  t,
}: {
  methods: PaymentMethod[];
  t: Dictionary;
}) {
  const [copied, setCopied] = useState<string | null>(null);

  if (methods.length === 0) {
    return <p className="cx-topup__hint">{t.topup.methodsNone}</p>;
  }

  const copy = async (key: string, value: string) => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(key);
      window.setTimeout(() => setCopied((c) => (c === key ? null : c)), 1800);
    } catch {
      // Presse-papiers refusé (contexte non sécurisé, permission) : la
      // valeur reste lisible et sélectionnable à l'écran.
    }
  };

  return (
    <ul className="cx-paylist">
      {methods.map((method) => (
        <li key={method.id} className="cx-paylist__item">
          <span className="cx-paylist__icon" aria-hidden="true">
            {method.icon_url ? (
              <Image src={method.icon_url} alt="" width={34} height={34} unoptimized />
            ) : (
              <span className="cx-paylist__initials">
                {method.name.slice(0, 2).toUpperCase()}
              </span>
            )}
          </span>

          <span className="cx-paylist__body">
            <span className="cx-paylist__name">{method.name}</span>

            {method.account_number && (
              <button
                type="button"
                className="cx-paylist__value"
                onClick={() => copy(`${method.id}-account`, method.account_number!)}
                title={t.topup.copy}
              >
                <span className="cx-paylist__label">{t.topup.methodAccount}</span>
                <span className="cx-paylist__number">{method.account_number}</span>
                <span className="cx-paylist__copy">
                  {copied === `${method.id}-account` ? t.topup.copied : t.topup.copy}
                </span>
              </button>
            )}

            {method.rib && (
              <button
                type="button"
                className="cx-paylist__value"
                onClick={() => copy(`${method.id}-rib`, method.rib!)}
                title={t.topup.copy}
              >
                <span className="cx-paylist__label">{t.topup.methodRib}</span>
                <span className="cx-paylist__number">{method.rib}</span>
                <span className="cx-paylist__copy">
                  {copied === `${method.id}-rib` ? t.topup.copied : t.topup.copy}
                </span>
              </button>
            )}

            {method.instructions && (
              <span className="cx-paylist__note">{method.instructions}</span>
            )}
          </span>
        </li>
      ))}
    </ul>
  );
}
