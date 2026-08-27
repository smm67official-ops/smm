import { redirect } from 'next/navigation';
import OnboardingForm from '@/components/auth/OnboardingForm';
import { getSessionUser } from '@/lib/auth';
import { getDictionary } from '@/i18n';
import type { Locale } from '@/i18n/config';

export const dynamic = 'force-dynamic';

type Params = Promise<{ locale: string }>;

/**
 * Finalisation du profil.
 *
 * La page se garde elle-même plutôt que de faire confiance au chemin
 * d'arrivée : on peut y venir par le lien de rappel OAuth, mais aussi en
 * tapant l'URL. Un compte déjà finalisé repart vers son tableau de bord,
 * sinon l'étape se rejouerait indéfiniment.
 */
export default async function OnboardingPage({ params }: { params: Params }) {
  const { locale } = await params;
  const t = getDictionary(locale);
  const l = locale as Locale;

  const user = await getSessionUser();
  if (!user) redirect(`/${locale}/login?redirect=/${locale}/onboarding`);

  // Colonne absente (migration 010 non appliquée) : `onboarded_at` vaut
  // `undefined`, et l'étape est simplement ignorée.
  const done = user.profile?.onboarded_at ?? undefined;
  if (done !== null) redirect(`/${locale}/account`);

  const name = user.profile?.full_name || user.profile?.username || user.email.split('@')[0];

  return (
    <div className="cx">
      <main className="cx-wrap" style={{ maxWidth: 640 }}>
        <OnboardingForm
          locale={l}
          t={t}
          name={name}
          defaultWhatsapp={user.profile?.whatsapp ?? user.profile?.phone ?? null}
        />
      </main>
    </div>
  );
}
