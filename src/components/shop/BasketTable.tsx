'use client';

import Link from 'next/link';
import { useBasket, chargeOf } from '@/components/providers/BasketProvider';
import { money } from '@/lib/format';
import { platformOf } from '@/lib/platforms';
import type { Locale } from '@/i18n/config';
import type { Dictionary } from '@/i18n';

/**
 * Panier en cartes verticales — pas de tableau horizontal.
 * Le total et l'action principale restent collés en bas sur mobile.
 */
export default function BasketTable({ locale, t }: { locale: Locale; t: Dictionary }) {
  const { basket, ready, update, remove, clear, total } = useBasket();

  if (!ready) {
    return (
      <div className="cx-stack cx-stack--tight">
        <div className="cx-skeleton cx-skeleton--card" />
        <div className="cx-skeleton cx-skeleton--card" />
      </div>
    );
  }

  if (basket.length === 0) {
    return (
      <div className="cx-card">
        <div className="cx-empty">
          <span className="cx-empty__icon">
            <i className="ion-bag" />
          </span>
          <h3>{t.cart.empty}</h3>
          <p>{t.cart.emptyHint}</p>
          <Link href={`/${locale}/services`} className="cx-btn cx-btn--primary cx-btn--auto">
            {t.cart.browse}
          </Link>
        </div>
      </div>
    );
  }

  const invalid = basket.some(
    (line) => line.type !== 'Package' && (line.quantity < line.min || line.quantity > line.max)
  );

  return (
    <>
      <div className="cx-stack cx-stack--tight">
        {basket.map((line) => {
          const platform = platformOf(line.platform);
          const outOfRange =
            line.type !== 'Package' && (line.quantity < line.min || line.quantity > line.max);

          return (
            <article className="cx-line" key={line.id} data-motion="item">
              <span className="cx-order__icon">
                <i className={platform?.icon ?? 'ion-bag'} />
              </span>

              <div className="cx-line__body">
                <h3 className="cx-line__name">{line.name}</h3>
                {line.link && <span className="cx-line__link">{line.link}</span>}

                <div className="cx-line__foot">
                  <div className="cx-stepper">
                    <button
                      type="button"
                      aria-label="-"
                      onClick={() =>
                        update(line.id, {
                          quantity: Math.max(line.min, line.quantity - line.min),
                        })
                      }
                    >
                      −
                    </button>
                    <input
                      type="number"
                      inputMode="numeric"
                      min={line.min}
                      max={line.max}
                      value={line.quantity}
                      aria-label={t.cart.colQuantity}
                      onChange={(e) =>
                        update(line.id, { quantity: Number(e.target.value) || line.min })
                      }
                    />
                    <button
                      type="button"
                      aria-label="+"
                      onClick={() =>
                        update(line.id, {
                          quantity: Math.min(line.max, line.quantity + line.min),
                        })
                      }
                    >
                      +
                    </button>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <span className="cx-order__price">{money(chargeOf(line))}</span>
                    <button
                      type="button"
                      className="cx-remove"
                      aria-label={t.cart.colRemove}
                      onClick={() => remove(line.id)}
                    >
                      <i className="ion-trash-b" />
                    </button>
                  </div>
                </div>

                {outOfRange && (
                  <span className="cx-field__err" style={{ display: 'block', marginTop: 8 }}>
                    {line.min.toLocaleString()} – {line.max.toLocaleString()}
                  </span>
                )}
              </div>
            </article>
          );
        })}
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 14 }}>
        <Link href={`/${locale}/services`} className="cx-btn cx-btn--sm cx-btn--ghost">
          <i className="ion-plus" />
          {t.cart.continue}
        </Link>
        <button type="button" className="cx-btn cx-btn--sm cx-btn--ghost" onClick={clear}>
          {t.cart.clear}
        </button>
      </div>

      {/* Barre collante : total visible et action unique */}
      <div className="cx-sticky">
        <div className="cx-sticky__row">
          <span>
            {basket.length} {basket.length === 1 ? t.cart.itemOne : t.cart.itemMany}
          </span>
          <span className="cx-sticky__total">{money(total)}</span>
        </div>
        <Link
          href={invalid ? '#' : `/${locale}/checkout`}
          className="cx-btn cx-btn--primary"
          data-hover="raise"
          aria-disabled={invalid}
          style={invalid ? { opacity: 0.5, pointerEvents: 'none' } : undefined}
        >
          {t.cart.checkout}
          <i className="ion-arrow-right-c" />
        </Link>
      </div>
    </>
  );
}
