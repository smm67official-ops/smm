/**
 * Layout racine « passe-plat » : les balises <html> et <body> sont définies
 * dans app/[locale]/layout.tsx, car la langue et la direction (RTL/LTR)
 * dépendent du segment de langue.
 */
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return children;
}
