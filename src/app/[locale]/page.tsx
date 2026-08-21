import Link from 'next/link';
import HeroSlider from '@/components/home/HeroSlider';
import PlatformsSwiper from '@/components/home/PlatformsSwiper';
import Testimonials from '@/components/home/Testimonials';
import Faq from '@/components/home/Faq';
import Marquee from '@/components/ui/Marquee';
import { getActivePlatforms, getCatalogueHighlights, hasSupabaseEnv } from '@/lib/queries';
import { getDictionary } from '@/i18n';
import { PLATFORMS, platformOf } from '@/lib/platforms';
import type { Locale } from '@/i18n/config';

type Params = Promise<{ locale: string }>;

const FEATURE_ICONS = [
  'ion-locked',
  'ion-code',
  'ion-headphone',
  'ion-speedometer',
  'ion-pricetag',
  'ion-flash',
  'ion-card',
  'ion-loop',
];

const GROWTH_ITEMS = [
  { label: 'Facebook Likes', value: '1.2M', platform: 'facebook' },
  { label: 'Instagram Followers', value: '1.2M', platform: 'instagram' },
  { label: 'Twitter Followers', value: '1.2M', platform: 'twitter' },
  { label: 'TikTok Followers', value: '1.2M', platform: 'tiktok' },
  { label: 'YouTube Subscribers', value: '1.2M', platform: 'youtube' },
];

export default async function HomePage({ params }: { params: Params }) {
  const { locale } = await params;
  const t = getDictionary(locale);
  const l = locale as Locale;

  const [activePlatforms, highlights] = await Promise.all([
    getActivePlatforms(),
    getCatalogueHighlights(),
  ]);

  // Arrondi au millième supérieur : annoncer un prix plus bas que le
  // moins cher réellement listé serait faux.
  const lowestRate = highlights.lowestRate
    ? `$${(Math.ceil(highlights.lowestRate * 1000) / 1000).toFixed(3)}`
    : '$0.001';

  return (
    <>
      <HeroSlider
        locale={l}
        t={t}
        serviceCount={highlights.serviceCount}
        lowestRate={lowestRate}
      />

      <main className="page-content">
        {!hasSupabaseEnv() && (
          <div className="container" style={{ paddingTop: 30 }}>
            <p className="tm-alert">{t.common.supabaseMissing}</p>
          </div>
        )}

        {/* Carrousel des plateformes */}
        <PlatformsSwiper locale={l} t={t} availablePlatforms={activePlatforms} />

        {/* Présentation */}
        <div className="tm-section tm-intro-area bg-grey tm-padding-section">
          <div className="container">
            <div className="row align-items-center">
              <div className="col-lg-7 col-12">
                <div className="tm-about-content">
                  <h4>{t.intro.title}</h4>
                  <p>{t.intro.text}</p>
                  <ul className="tm-checklist">
                    {t.intro.bullets.map((bullet) => (
                      <li key={bullet}>
                        <i className="ion-checkmark-circled" />
                        {bullet}
                      </li>
                    ))}
                  </ul>
                  <Link href={`/${l}/signup`} className="tm-button">
                    {t.hero.ctaSecondary}
                  </Link>
                </div>
              </div>
              <div className="col-lg-5 col-12">
                <div className="tm-about-image tm-intro-image">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src="/assets/images/qmjutx50c479hsad.webp" alt={t.intro.title} />
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Étapes */}
        <div className="tm-section tm-steps-area bg-white tm-padding-section">
          <div className="container">
            <div className="row justify-content-center">
              <div className="col-lg-8 col-12">
                <div className="tm-sectiontitle text-center" data-reveal>
                  <h6 className="tm-sectiontitle-sub">{t.howItWorks.title}</h6>
                  <h3>{t.howItWorks.subtitle}</h3>
                </div>
              </div>
            </div>
            <div className="row mt-30-reverse">
              {t.howItWorks.steps.map((step, i) => (
                <div className="col-lg-3 col-md-6 col-12 mt-30" key={step.title}>
                  <div className="tm-step tm-scrollanim">
                    <span className="tm-step-number">{String(i + 1).padStart(2, '0')}</span>
                    <h6>{step.title}</h6>
                    <p>{step.text}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Pourquoi nous */}
        <div className="tm-section tm-why-area bg-grey tm-padding-section">
          <div className="container">
            <div className="row justify-content-center">
              <div className="col-lg-8 col-12">
                <div className="tm-sectiontitle text-center" data-reveal>
                  <h3>{t.why.title}</h3>
                </div>
              </div>
            </div>
            <div className="row align-items-center">
              <div className="col-lg-7 col-12">
                <div className="tm-about-content">
                  <h4>{t.why.heading}</h4>
                  {t.why.paragraphs.map((paragraph) => (
                    <p key={paragraph.slice(0, 40)}>{paragraph}</p>
                  ))}
                </div>
              </div>
              <div className="col-lg-5 col-12">
                <div className="tm-whylist">
                  <h6>{t.why.listTitle}</h6>
                  <ul className="tm-checklist">
                    {t.why.list.map((item) => (
                      <li key={item}>
                        <i className="ion-checkmark-circled" />
                        {item}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Avantages */}
        <div className="tm-section tm-features-area bg-white tm-padding-section">
          <div className="container">
            <div className="row justify-content-center">
              <div className="col-lg-8 col-12">
                <div className="tm-sectiontitle text-center" data-reveal>
                  <h6 className="tm-sectiontitle-sub">{t.features.title}</h6>
                  <h3>{t.features.subtitle}</h3>
                </div>
              </div>
            </div>
            <div className="row mt-30-reverse">
              {t.features.items.map((item, i) => (
                <div className="col-lg-3 col-md-6 col-12 mt-30" key={item.title}>
                  <div className="tm-feature tm-feature-card tm-scrollanim">
                    <span className="tm-feature-icon">
                      <i className={FEATURE_ICONS[i % FEATURE_ICONS.length]} />
                    </span>
                    <div className="tm-feature-content">
                      <h6>{item.title}</h6>
                      <p>{item.text}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Services par plateforme */}
        <div className="tm-section tm-platformservices-area bg-grey tm-padding-section">
          <div className="container">
            <div className="row justify-content-center">
              <div className="col-lg-8 col-12">
                <div className="tm-sectiontitle text-center" data-reveal>
                  <h6 className="tm-sectiontitle-sub">{t.platformServices.title}</h6>
                  <h3>{t.platformServices.subtitle}</h3>
                  <p>{t.platformServices.text}</p>
                </div>
              </div>
            </div>
            <div className="row mt-30-reverse">
              {t.platformServices.items.map((item, i) => {
                const platform = PLATFORMS[i % PLATFORMS.length];
                return (
                  <div className="col-lg-3 col-md-6 col-12 mt-30" key={item.name}>
                    <div className="tm-platformcard tm-scrollanim">
                      <span className="tm-platform-icon" style={{ backgroundColor: platform.color }}>
                        <i className={platform.icon} />
                      </span>
                      <h6>{item.name}</h6>
                      <p>{item.text}</p>
                      <ul className="tm-checklist tm-checklist-sm">
                        {item.bullets.map((bullet) => (
                          <li key={bullet}>
                            <i className="ion-checkmark" />
                            {bullet}
                          </li>
                        ))}
                      </ul>
                      <Link
                        href={`/${l}/services?platform=${platform.slug}`}
                        className="tm-readmore"
                      >
                        {t.services.order}
                      </Link>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Comparatif */}
        <div className="tm-section tm-comparison-area bg-white tm-padding-section">
          <div className="container">
            <div className="row justify-content-center">
              <div className="col-lg-8 col-12">
                <div className="tm-sectiontitle text-center" data-reveal>
                  <h6 className="tm-sectiontitle-sub">{t.comparison.title}</h6>
                  <h3>{t.comparison.subtitle}</h3>
                </div>
              </div>
            </div>
            <div className="row justify-content-center mt-30-reverse">
              <div className="col-lg-6 col-12 mt-30">
                <div className="tm-comparison tm-comparison-others">
                  <h5>{t.comparison.othersTitle}</h5>
                  <ul>
                    {t.comparison.others.map((item) => (
                      <li key={item}>
                        <i className="ion-close-circled" />
                        {item}
                      </li>
                    ))}
                  </ul>
                  <div className="tm-comparison-score">{t.comparison.othersScore}</div>
                </div>
              </div>
              <div className="col-lg-6 col-12 mt-30">
                <div className="tm-comparison tm-comparison-us">
                  <h5>{t.comparison.usTitle}</h5>
                  <ul>
                    {t.comparison.us.map((item) => (
                      <li key={item}>
                        <i className="ion-checkmark-circled" />
                        {item}
                      </li>
                    ))}
                  </ul>
                  <div className="tm-comparison-score">{t.comparison.usScore}</div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Avis clients */}
        <Testimonials t={t} />

        {/* Moyens de paiement */}
        <div className="tm-section tm-payments-area bg-white tm-padding-section">
          <div className="container">
            <div className="row justify-content-center">
              <div className="col-lg-8 col-12">
                <div className="tm-sectiontitle text-center" data-reveal>
                  <h6 className="tm-sectiontitle-sub">{t.payments.title}</h6>
                  <h3>{t.payments.subtitle}</h3>
                </div>
              </div>
            </div>
            <div className="text-center">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/assets/images/payment-methods.png" alt={t.payments.title} />
            </div>
          </div>
        </div>

        {/* FAQ */}
        <Faq locale={l} t={t} />

        {/* Bandeau de croissance + appel à l'action */}
        <div className="tm-section tm-cta-area bg-grey tm-padding-section">
          <div className="container">
            <div className="row justify-content-center">
              <div className="col-lg-8 col-12">
                <div className="tm-sectiontitle text-center" data-reveal>
                  <h6 className="tm-sectiontitle-sub">{t.cta.title}</h6>
                  <h3>{t.cta.text}</h3>
                </div>
              </div>
            </div>
          </div>

          <Marquee speed={35}>
            {GROWTH_ITEMS.map((item) => {
              const platform = platformOf(item.platform);
              return (
                <span className="tm-growth" key={item.label}>
                  <i className={platform?.icon} style={{ color: platform?.color }} />
                  <b>{item.value}</b>
                  {item.label}
                </span>
              );
            })}
          </Marquee>

          <div className="container text-center" style={{ marginTop: 40 }}>
            <Link href={`/${l}/signup`} className="tm-button">
              {t.cta.button}
            </Link>
          </div>
        </div>
      </main>
    </>
  );
}
