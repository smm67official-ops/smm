import type { Metadata } from 'next';
import { Plus_Jakarta_Sans } from 'next/font/google';
import { ToastProvider } from '@/design-system';
import '@/design-system/tokens.css';
import '@/design-system/socialvault.css';

const jakarta = Plus_Jakarta_Sans({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  variable: '--sv-font-family',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'SocialVault — Design System',
  description:
    'Design tokens et composants réutilisables du marketplace SocialVault : navbar, hero, cartes, filtres, tableaux, modales, toasts et dashboard.',
};

/**
 * Layout autonome : le design system est volontairement isolé du thème
 * Bootstrap du reste du site (aucun style hérité, aucune collision).
 */
export default function DesignSystemLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body
        className={jakarta.variable}
        style={{ margin: 0, ['--sv-font' as string]: 'var(--sv-font-family)' }}
      >
        <ToastProvider>
          <div className="sv-root">{children}</div>
        </ToastProvider>
      </body>
    </html>
  );
}
