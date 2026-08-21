import type { ReactNode } from 'react';

export type HeroProps = {
  eyebrow?: ReactNode;
  title: ReactNode;
  text?: ReactNode;
  actions?: ReactNode;
  proof?: ReactNode;
  visual?: ReactNode;
  floating?: ReactNode;
};

/**
 * Hero du marketplace : typographie à gauche, éléments 3D et cartes
 * flottantes à droite, halos lavande en fond.
 */
export default function Hero({ eyebrow, title, text, actions, proof, visual, floating }: HeroProps) {
  return (
    <section className="sv-hero">
      <div className="sv-container sv-hero__inner">
        <div>
          {eyebrow && <span className="sv-eyebrow">{eyebrow}</span>}
          <h1 className="sv-hero__title">{title}</h1>
          {text && <p className="sv-lead sv-hero__text">{text}</p>}
          {actions && <div className="sv-hero__actions">{actions}</div>}
          {proof && <div className="sv-hero__proof">{proof}</div>}
        </div>

        <div className="sv-hero__visual">
          {visual}
          {floating}
        </div>
      </div>
    </section>
  );
}
