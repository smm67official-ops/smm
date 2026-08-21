'use client';

import { useEffect, useState } from 'react';
import type { Dictionary } from '@/i18n';

/** Carrousel d'avis : 3 visibles en desktop, 1 en mobile, défilement auto. */
export default function Testimonials({ t }: { t: Dictionary }) {
  const items = t.testimonials.items;
  const [index, setIndex] = useState(0);
  const [perView, setPerView] = useState(3);

  useEffect(() => {
    const compute = () => {
      const width = window.innerWidth;
      setPerView(width < 768 ? 1 : width < 1200 ? 2 : 3);
    };
    compute();
    window.addEventListener('resize', compute);
    return () => window.removeEventListener('resize', compute);
  }, []);

  useEffect(() => {
    const timer = setInterval(() => setIndex((i) => (i + 1) % items.length), 5000);
    return () => clearInterval(timer);
  }, [items.length]);

  const visible = Array.from({ length: perView }, (_, offset) => items[(index + offset) % items.length]);

  return (
    <div className="tm-section tm-testimonials-area bg-grey tm-padding-section">
      <div className="container">
        <div className="row justify-content-center">
          <div className="col-lg-8 col-12">
            <div className="tm-sectiontitle text-center">
              <h6 className="tm-sectiontitle-sub">{t.testimonials.title}</h6>
              <h3>{t.testimonials.subtitle}</h3>
              <p>
                <i className="ion-star" style={{ color: '#f2ba59' }} /> {t.testimonials.rating}
              </p>
            </div>
          </div>
        </div>

        <div className="row mt-30-reverse">
          {visible.map((item, i) => (
            <div className={`col-lg-${12 / perView} col-md-6 col-12 mt-30`} key={`${item.name}-${i}`}>
              <div className="tm-testimonial">
                <div className="tm-testimonial-head">
                  <h6>{item.name}</h6>
                  <span className="tm-testimonial-score">
                    <i className="ion-star" /> {item.score}
                  </span>
                </div>
                <span className="tm-testimonial-verified">
                  <i className="ion-checkmark-circled" /> {t.testimonials.verified}
                </span>
                <h5>{item.title}</h5>
                <p>{item.text}</p>
              </div>
            </div>
          ))}
        </div>

        <ul className="tm-testimonial-dots">
          {items.map((item, i) => (
            <li key={`dot-${item.name}-${i}`}>
              <button
                type="button"
                aria-label={`Review ${i + 1}`}
                className={i === index ? 'is-active' : undefined}
                onClick={() => setIndex(i)}
              />
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
