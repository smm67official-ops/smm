'use client';

import Link from 'next/link';
import { useState } from 'react';
import type { Locale } from '@/i18n/config';
import type { Dictionary } from '@/i18n';

export default function Faq({ locale, t }: { locale: Locale; t: Dictionary }) {
  const [open, setOpen] = useState<number | null>(0);

  return (
    <div className="tm-section tm-faq-area bg-white tm-padding-section">
      <div className="container">
        <div className="row justify-content-center">
          <div className="col-lg-8 col-12">
            <div className="tm-sectiontitle text-center">
              <h6 className="tm-sectiontitle-sub">{t.faq.title}</h6>
              <h3>{t.faq.subtitle}</h3>
            </div>
          </div>
        </div>

        <div className="row justify-content-center">
          <div className="col-lg-10 col-12">
            <div className="tm-faq">
              {t.faq.items.map((item, i) => (
                <div className={`tm-faq-item${open === i ? ' is-open' : ''}`} key={item.q}>
                  <button
                    type="button"
                    className="tm-faq-question"
                    aria-expanded={open === i}
                    onClick={() => setOpen(open === i ? null : i)}
                  >
                    <span>{item.q}</span>
                    <i className={open === i ? 'ion-minus' : 'ion-plus'} />
                  </button>
                  {open === i && (
                    <div className="tm-faq-answer">
                      <p>{item.a}</p>
                    </div>
                  )}
                </div>
              ))}
            </div>

            <div className="tm-faq-more text-center">
              <h5>{t.faq.more}</h5>
              <p>{t.faq.moreText}</p>
              <Link href={`/${locale}/contact`} className="tm-button">
                {t.faq.moreCta}
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
