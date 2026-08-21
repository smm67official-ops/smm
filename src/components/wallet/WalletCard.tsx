'use client';

import Link from 'next/link';
import { useRef, useState } from 'react';
import TopUpFlow from '@/components/wallet/TopUpFlow';
import { useGsap } from '@/lib/motion/useGsap';
import { countUp } from '@/lib/motion/presets';
import { money } from '@/lib/format';
import type { Locale } from '@/i18n/config';
import type { Dictionary } from '@/i18n';

/**
 * Carte portefeuille : solde, demandes en cours, et l'action principale
 * de l'écran — « Ajouter de l'argent ».
 *
 * Le solde monte jusqu'à sa valeur à l'ouverture. Ce n'est pas
 * décoratif : le regard est attiré vers le chiffre qui conditionne la
 * commande, puis vers le bouton juste en dessous.
 */
export default function WalletCard({
  locale,
  t,
  balance,
  pending = 0,
  showHistoryLink = true,
  defaultWhatsapp,
}: {
  locale: Locale;
  t: Dictionary;
  balance: number;
  pending?: number;
  showHistoryLink?: boolean;
  defaultWhatsapp?: string | null;
}) {
  const [open, setOpen] = useState(false);
  const valueRef = useRef<HTMLParagraphElement>(null);

  useGsap(() => {
    if (valueRef.current) countUp(valueRef.current, balance, money, { delay: 0.18 });
  }, [balance]);

  return (
    <>
      <section className="cx-balance" data-motion="body">
        <p className="cx-balance__label">{t.wallet.balance}</p>

        {/* Valeur de repli : si le script n'anime pas, le solde reste juste. */}
        <p ref={valueRef} className="cx-balance__value">
          {money(balance)}
        </p>

        {pending > 0 && (
          <p className="cx-balance__pending">
            <i className="ion-clock" />
            {pending === 1
              ? t.topup.pendingOne
              : t.topup.pendingMany.replace('{count}', String(pending))}
          </p>
        )}

        <div className="cx-balance__actions">
          <button
            type="button"
            className="cx-btn cx-btn--primary cx-btn--sm cx-btn--wide"
            data-press
            data-hover="raise"
            onClick={() => setOpen(true)}
          >
            <i className="ion-plus" />
            {t.topup.cta}
          </button>

          {showHistoryLink && (
            <Link href={`/${locale}/account/wallet`} className="cx-balance__link">
              {t.dashboard.walletLink}
              <i className="ion-chevron-right" />
            </Link>
          )}
        </div>
      </section>

      <TopUpFlow
        locale={locale}
        t={t}
        open={open}
        onClose={() => setOpen(false)}
        defaultWhatsapp={defaultWhatsapp}
      />
    </>
  );
}
