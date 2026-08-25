import { redirect } from 'next/navigation';
import AdminShell from '@/components/admin/AdminShell';
import { getSessionUser, isAdminRole } from '@/lib/auth';

type Params = Promise<{ locale: string }>;

/**
 * Pages protégées de l'administration.
 *
 * Le groupe `(dashboard)` n'apparaît pas dans l'URL : `/admin`,
 * `/admin/orders`… restent inchangés. Il sert uniquement à délimiter ce
 * que la garde couvre — la page de connexion, un cran au-dessus, en est
 * exclue, ce qui supprime la boucle de redirection.
 */
export default async function AdminDashboardLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Params;
}) {
  const { locale } = await params;
  const user = await getSessionUser();

  // Visiteur : le middleware couvre déjà le cas, ceci protège l'accès direct.
  if (!user) redirect(`/${locale}/admin/login`);

  // Connecté mais sans le rôle : on l'annonce sur la page de connexion,
  // qui propose de changer de compte.
  if (!isAdminRole(user.role)) redirect(`/${locale}/admin/login?error=forbidden`);

  return (
    <AdminShell locale={locale} email={user.email} role={user.role}>
      {children}
    </AdminShell>
  );
}
