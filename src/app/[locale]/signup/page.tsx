import Link from 'next/link';
import Breadcrumb from '@/components/ui/Breadcrumb';
import RegisterForm from '@/components/auth/RegisterForm';
import { getDictionary } from '@/i18n';
import type { Locale } from '@/i18n/config';

type Params = Promise<{ locale: string }>;

export default async function SignupPage({ params }: { params: Params }) {
  const { locale } = await params;
  const t = getDictionary(locale);
  const l = locale as Locale;

  return (
    <>
      <Breadcrumb locale={l} title={t.auth.registerTitle} crumbs={[{ label: t.auth.registerTitle }]} />

      <main className="page-content">
        <div className="tm-section tm-login-register-area bg-white tm-padding-section">
          <div className="container">
            <div className="row justify-content-center">
              <div className="col-lg-6 col-md-8 col-12" data-motion="body">
                <RegisterForm locale={l} t={t} />
                <p className="mt-3 text-center">
                  {t.auth.hasAccount} <Link href={`/${l}/login`}>{t.auth.signIn}</Link>
                </p>
              </div>
            </div>
          </div>
        </div>
      </main>
    </>
  );
}
