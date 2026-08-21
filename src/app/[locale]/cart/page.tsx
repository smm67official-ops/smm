import Link from 'next/link';
import BasketTable from '@/components/shop/BasketTable';
import { getDictionary } from '@/i18n';
import type { Locale } from '@/i18n/config';

type Params = Promise<{ locale: string }>;

export default async function CartPage({ params }: { params: Params }) {
  const { locale } = await params;
  const t = getDictionary(locale);
  const l = locale as Locale;

  return (
    <div className="cx cx-has-bottomnav">
      <main className="cx-wrap">
        <Link href={`/${l}/services`} className="cx-order__cta" style={{ marginBottom: 14 }}>
          <i className="ion-chevron-left" />
          {t.cart.browse}
        </Link>

        <header className="cx-greeting" data-motion="head">
          <h1 className="cx-greeting__name">{t.cart.title}</h1>
          <p className="cx-greeting__sub">{t.cart.subtitle}</p>
        </header>

        <div style={{ marginTop: 16 }}>
          <BasketTable locale={l} t={t} />
        </div>
      </main>
    </div>
  );
}
