import Link from 'next/link';
import { BRAND, HERO_PLATFORMS } from '@/lib/brand';
import type { Locale } from '@/i18n/config';
import type { Dictionary } from '@/i18n';

/**
 * Bandeau d'accueil.
 *
 * Fond noir : le visuel est un JPEG sur fond noir, sans canal alpha. Le
 * poser sur clair laisserait un rectangle visible ; on construit donc la
 * scène autour de lui — halo doré et voûte de points en CSS — pour qu'il
 * s'y fonde sans découpe.
 *
 * Composant serveur : plus aucune interactivité depuis que le carrousel
 * d'accroches a laissé place à un message unique. Le plus gros élément
 * de la page se peint donc sans attendre le JavaScript.
 */
export default function HeroSlider({
  locale,
  t,
  serviceCount,
  lowestRate,
}: {
  locale: Locale;
  t: Dictionary;
  /** Nombre réel de services actifs au catalogue. */
  serviceCount: number;
  /** Tarif le plus bas réellement proposé, pour 1 000 unités. */
  lowestRate: string;
  }) {
  const text = t.hero.text
    .replace('{services}', serviceCount.toLocaleString(locale === 'ar' ? 'en' : locale))
    .replace('{rate}', lowestRate);

  const offer = t.hero.offer.replace('{amount}', '$100').replace('{percent}', '5%');

  return (
    <section className="s67-hero">
      <span className="s67-hero__glow" aria-hidden="true" />
      <span className="s67-hero__dots" aria-hidden="true" />

      <div className="container">
        <div className="row align-items-center">
          <div className="col-lg-6 col-12">
            <div className="s67-hero__content">
              <p className="s67-hero__eyebrow">
                <i className="ion-star" aria-hidden="true" />
                {t.hero.eyebrow}
              </p>

              <h1>{t.hero.title}</h1>
              <p className="s67-hero__text">{text}</p>

              <div className="s67-hero__actions">
                <Link
                  href={`/${locale}/services`}
                  className="s67-btn s67-btn--primary"
                  data-hover="raise"
                >
                  {t.hero.cta}
                  <i className="ion-arrow-right-c" />
                </Link>
                <Link href={`/${locale}/signup`} className="s67-btn s67-btn--ghost">
                  {t.hero.ctaSecondary}
                </Link>
              </div>

              {/*
                L'offre est tenue par le code : au-delà de 100 $, la demande
                de recharge enregistre 5 % de bonus (voir `bonusFor`), et
                l'approbation crédite le total. Ce n'est pas un slogan.
              */}
              <p className="s67-hero__offer">
                <i className="ion-ribbon-a" aria-hidden="true" />
                {offer}
              </p>
            </div>
          </div>

          <div className="col-lg-6 col-12">
            <div className="s67-hero__visual">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={BRAND.heroImage}
                alt=""
                aria-hidden="true"
                className="s67-hero__photo"
                fetchPriority="high"
              />

              {/*
                Le logo complet (677 × 369, marque + nom + baseline) devient
                illisible réduit à une pastille : on n'affiche que le nom.
              */}
              <span className="s67-hero__badge">
                <i className="ion-arrow-graph-up-right" aria-hidden="true" />
                {BRAND.name}
              </span>

              <ul className="s67-hero__platforms">
                {HERO_PLATFORMS.map((platform) => (
                  <li key={platform.id}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={platform.icon} alt={platform.label} loading="lazy" />
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
