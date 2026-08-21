import Link from 'next/link';
import { redirect } from 'next/navigation';
import ProfileForm from '@/components/account/ProfileForm';
import { getSessionUser } from '@/lib/auth';
import { getDictionary } from '@/i18n';
import type { Locale } from '@/i18n/config';

export const dynamic = 'force-dynamic';

type Params = Promise<{ locale: string }>;

export default async function ProfilePage({ params }: { params: Params }) {
  const { locale } = await params;
  const t = getDictionary(locale);
  const l = locale as Locale;

  const user = await getSessionUser();
  if (!user) redirect(`/${l}/login?redirect=/${l}/account/profile`);

  return (
    <div className="cx cx-has-bottomnav">
      <main className="cx-wrap">
        <Link href={`/${l}/account`} className="cx-order__cta" style={{ marginBottom: 14 }}>
          <i className="ion-chevron-left" />
          {t.dashboard.back}
        </Link>

        <header className="cx-greeting" data-motion="head">
          <h1 className="cx-greeting__name">{t.dashboard.profile}</h1>
          <p className="cx-greeting__sub">{t.dashboard.profileHint}</p>
        </header>

        <div style={{ marginTop: 16 }}>
          <ProfileForm
            locale={l}
            t={t}
            email={user.email}
            profile={{
              id: user.id,
              full_name: user.profile?.full_name ?? '',
              username: user.profile?.username ?? '',
              phone: user.profile?.phone ?? '',
            }}
          />
        </div>
      </main>
    </div>
  );
}
