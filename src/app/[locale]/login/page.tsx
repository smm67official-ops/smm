import Link from 'next/link';
import { Suspense } from 'react';
import Breadcrumb from '@/components/ui/Breadcrumb';
import LoginForm from '@/components/auth/LoginForm';
import { getDictionary } from '@/i18n';
import type { Locale } from '@/i18n/config';

type Params = Promise<{ locale: string }>;

export default async function LoginPage({ params }: { params: Params }) {
  const { locale } = await params;
  const t = getDictionary(locale);
  const l = locale as Locale;

  return (
    <>
      <Breadcrumb locale={l} title={t.auth.loginTitle} crumbs={[{ label: t.auth.loginTitle }]} />

      <main className="page-content">
        <div className="tm-section tm-login-register-area bg-white tm-padding-section">
          <div className="container">
            <div className="row justify-content-center">
              <div className="col-lg-6 col-md-8 col-12" data-motion="body">
                <Suspense fallback={<p>{t.common.loading}</p>}>
                  <LoginForm locale={l} t={t} />
                </Suspense>
                <p className="mt-3 text-center">
                  {t.auth.noAccount} <Link href={`/${l}/signup`}>{t.auth.createAccount}</Link>
                </p>
              </div>
            </div>
          </div>
        </div>
      </main>
    </>
  );
}
