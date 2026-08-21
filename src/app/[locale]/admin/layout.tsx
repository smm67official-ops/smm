import { redirect } from 'next/navigation';
import { ToastProvider } from '@/design-system';
import AdminShell from '@/components/admin/AdminShell';
import { getSessionUser, isAdminRole } from '@/lib/auth';
import { BRAND } from '@/lib/brand';
import '@/design-system/tokens.css';
import '@/design-system/socialvault.css';
import '@/design-system/admin.css';
import '@/design-system/dashy.css';

type Params = Promise<{ locale: string }>;

export const metadata = { title: `Admin — ${BRAND.name}` };

/**
 * L'espace admin utilise le design system SocialVault (dashboard pro),
 * le site client reste sur le thème d'origine.
 * La page de connexion est volontairement hors du shell.
 */
export default async function AdminLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Params;
}) {
  const { locale } = await params;
  const user = await getSessionUser();

  // Non authentifié : le middleware redirige déjà, ceci couvre l'accès direct.
  if (!user) {
    return (
      <ToastProvider>
        <div className="sv-root">{children}</div>
      </ToastProvider>
    );
  }

  if (!isAdminRole(user.role)) redirect(`/${locale}/admin/login?error=forbidden`);

  return (
    <ToastProvider>
      <div className="sv-root">
        <AdminShell locale={locale} email={user.email} role={user.role}>
          {children}
        </AdminShell>
      </div>
    </ToastProvider>
  );
}
