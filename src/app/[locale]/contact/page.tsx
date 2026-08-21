import Breadcrumb from '@/components/ui/Breadcrumb';
import ContactForm from '@/components/contact/ContactForm';
import { getDictionary } from '@/i18n';
import type { Locale } from '@/i18n/config';

type Params = Promise<{ locale: string }>;

export default async function ContactPage({ params }: { params: Params }) {
  const { locale } = await params;
  const t = getDictionary(locale);

  return (
    <>
      <Breadcrumb locale={locale as Locale} title={t.contact.title} crumbs={[{ label: t.contact.title }]} />

      <main className="page-content">
        <div className="tm-section tm-contact-area tm-padding-section bg-white">
          <div className="container">
            <div className="tm-contact-blocks">
              <div className="row mt-30-reverse justify-content-center" data-reveal>
                <div className="col-lg-4 col-md-6 mt-30" data-reveal-item>
                  <div className="tm-contact-block text-center">
                    <i className="ion-android-call" />
                    <h6>{t.contact.callUs}</h6>
                    <p>
                      <a href={`tel:${t.header.phone.replace(/\s/g, '')}`}>{t.header.phone}</a>
                    </p>
                  </div>
                </div>
                <div className="col-lg-4 col-md-6 mt-30" data-reveal-item>
                  <div className="tm-contact-block text-center">
                    <i className="ion-chatbubbles" />
                    <h6>WhatsApp / Telegram</h6>
                    <p>
                      <a
                        href={`https://wa.me/${t.header.phone.replace(/[^0-9]/g, '')}`}
                        target="_blank"
                        rel="noreferrer noopener"
                      >
                        WhatsApp
                      </a>
                    </p>
                  </div>
                </div>
                <div className="col-lg-4 col-md-6 mt-30" data-reveal-item>
                  <div className="tm-contact-block text-center">
                    <i className="ion-email" />
                    <h6>{t.contact.emailUs}</h6>
                    <p>
                      <a href={`mailto:${t.header.email}`}>{t.header.email}</a>
                    </p>
                  </div>
                </div>
              </div>
            </div>

            <div className="tm-contact-forms tm-padding-section-top">
              <div className="row justify-content-center">
                <div className="col-lg-6 col-12">
                  <div className="tm-sectiontitle text-center">
                    <h3>{t.contact.formTitle}</h3>
                    <p>{t.contact.formSubtitle}</p>
                  </div>
                </div>
              </div>
              <div className="row justify-content-center">
                <div className="col-lg-8" data-reveal>
                  <ContactForm t={t} />
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>
    </>
  );
}
