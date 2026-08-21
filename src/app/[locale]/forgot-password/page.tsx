import Breadcrumb from '@/components/ui/Breadcrumb';
import ForgotPasswordForm from '@/components/auth/ForgotPasswordForm';
import { getDictionary } from '@/i18n';
import type { Locale } from '@/i18n/config';

type Params = Promise<{ locale: string }>;

export default async function ForgotPasswordPage({ params }: { params: Params }) {
  const { locale } = await params;
  const t = getDictionary(locale);

  return (
    <>
      <Breadcrumb
        locale={locale as Locale}
        title={t.auth.forgotTitle}
        crumbs={[{ label: t.auth.forgotTitle }]}
      />
      <main className="page-content">
        <div className="tm-section tm-login-register-area bg-white tm-padding-section">
          <div className="container">
            <div className="row justify-content-center">
              <div className="col-lg-6 col-md-8 col-12" data-motion="body">
                <ForgotPasswordForm locale={locale as Locale} t={t} />
              </div>
            </div>
          </div>
        </div>
      </main>
    </>
  );
}
