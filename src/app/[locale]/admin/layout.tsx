import { ToastProvider } from '@/design-system';
import { BRAND } from '@/lib/brand';
import '@/design-system/tokens.css';
import '@/design-system/socialvault.css';
import '@/design-system/admin.css';
import '@/design-system/dashy.css';

export const metadata = { title: `Admin — ${BRAND.name}` };

/**
 * Habillage commun de l'espace d'administration : feuilles de style du
 * design system et fournisseur de notifications.
 *
 * Aucun contrôle d'accès ici. La page de connexion vit sous ce layout ;
 * y placer la garde créait une boucle — un utilisateur connecté mais non
 * administrateur était renvoyé vers `/admin/login`, page elle-même
 * soumise à la garde, qui le renvoyait de nouveau (ERR_TOO_MANY_REDIRECTS).
 *
 * La garde est descendue dans le groupe `(dashboard)`, qui couvre les
 * pages protégées sans englober la connexion.
 */
export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <ToastProvider>
      <div className="sv-root">{children}</div>
    </ToastProvider>
  );
}
