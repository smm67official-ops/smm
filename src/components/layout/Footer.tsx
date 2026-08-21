import Link from 'next/link';
import NewsletterForm from '@/components/layout/NewsletterForm';
import { API_DOCS_ENABLED, BRAND } from '@/lib/brand';
import type { Locale } from '@/i18n/config';
import type { Dictionary } from '@/i18n';

export default function Footer({ locale, t }: { locale: Locale; t: Dictionary }) {
  const href = (path: string) => `/${locale}${path}`;

  return (
    <div className="tm-footer bg-grey">
      <div className="tm-footer-toparea tm-padding-section">
        <div className="container">
          <div className="widgets widgets-footer row">
            <div className="col-lg-3 col-md-6 col-12">
              <div className="single-widget widget-info">
                <Link className="widget-info-logo" href={href('/')}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={BRAND.logo} alt={`${BRAND.name} — ${BRAND.tagline}`} />
                </Link>
                <p>{t.footer.about}</p>
                <ul>
                  {/*
                    `dir="ltr"` : un numéro et une adresse e-mail restent
                    des séquences latines. Sans cette marque, l'algorithme
                    bidirectionnel les réordonne en arabe et « +212 600… »
                    s'affiche à l'envers.
                  */}
                  <li>
                    <b>{t.footer.phone} :</b>
                    <a dir="ltr" href={`tel:${t.header.phone.replace(/\s/g, '')}`}>
                      {t.header.phone}
                    </a>
                  </li>
                  <li>
                    <b>{t.footer.email} :</b>
                    <a dir="ltr" href={`mailto:${t.header.email}`}>
                      {t.header.email}
                    </a>
                  </li>
                </ul>
              </div>
            </div>

            <div className="col-lg-3 col-md-6 col-12">
              <div className="single-widget widget-quicklinks">
                <h6 className="widget-title">{t.footer.usefulLinks}</h6>
                <ul>
                  <li><Link href={href('/services')}>{t.nav.services}</Link></li>
                  {API_DOCS_ENABLED && (
                    <li><Link href={href('/api-docs')}>{t.nav.api}</Link></li>
                  )}
                  <li><Link href={href('/contact')}>{t.nav.contact}</Link></li>
                  <li><Link href={href('/contact')}>{t.footer.terms}</Link></li>
                  <li><Link href={href('/contact')}>{t.footer.privacy}</Link></li>
                  <li><Link href={href('/contact')}>{t.footer.refund}</Link></li>
                </ul>
              </div>
            </div>

            <div className="col-lg-3 col-md-6 col-12">
              <div className="single-widget widget-quicklinks">
                <h6 className="widget-title">{t.footer.myAccount}</h6>
                <ul>
                  <li><Link href={href('/account')}>{t.nav.account}</Link></li>
                  <li><Link href={href('/cart')}>{t.nav.cart}</Link></li>
                  <li><Link href={href('/account/wallet')}>{t.wallet.title}</Link></li>
                  <li><Link href={href('/wishlist')}>{t.nav.favorites}</Link></li>
                  <li><Link href={href('/checkout')}>{t.nav.checkout}</Link></li>
                  <li><Link href={href('/login')}>{t.nav.login}</Link></li>
                  <li><Link href={href('/signup')}>{t.nav.register}</Link></li>
                </ul>
              </div>
            </div>

            <div className="col-lg-3 col-md-6 col-12">
              <div className="single-widget widget-newsletter">
                <h6 className="widget-title">{t.footer.newsletter}</h6>
                <p>{t.footer.newsletterText}</p>
                <NewsletterForm t={t} />
              </div>
            </div>
          </div>

          <p style={{ fontSize: 12, opacity: 0.7, marginTop: 30, marginBottom: 0 }}>
            {t.footer.disclaimer}
          </p>
        </div>
      </div>

      <div className="tm-footer-bottomarea">
        <div className="container">
          <div className="row align-items-center">
            <div className="col-md-7">
              <p className="tm-footer-copyright">
                © {new Date().getFullYear()} {BRAND.name} — {t.footer.copyright}
              </p>
            </div>
            <div className="col-md-5">
              <div className="tm-footer-payment">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src="/assets/images/payment-methods.png" alt="payment methods" />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
