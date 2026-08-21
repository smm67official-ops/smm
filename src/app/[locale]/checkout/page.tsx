import Link from 'next/link';
import CheckoutForm from '@/components/shop/CheckoutForm';
import { getSessionUser } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { getDictionary } from '@/i18n';
import type { Locale } from '@/i18n/config';

export const dynamic = 'force-dynamic';

type Params = Promise<{ locale: string }>;

export default async function CheckoutPage({ params }: { params: Params }) {
  const { locale } = await params;
  const t = getDictionary(locale);
  const l = locale as Locale;

  const user = await getSessionUser();

  // Dernier numéro utilisé : évite de le ressaisir à chaque commande.
  let lastWhatsapp: string | null = null;
  if (user) {
    const supabase = await createClient();
    const { data } = await supabase
      .from('orders')
      .select('whatsapp')
      .eq('user_id', user.id)
      .not('whatsapp', 'is', null)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    lastWhatsapp = data?.whatsapp ?? null;
  }

  return (
    <div className="cx cx-has-bottomnav">
      <main className="cx-wrap">
        <Link href={`/${l}/cart`} className="cx-order__cta" style={{ marginBottom: 14 }}>
          <i className="ion-chevron-left" />
          {t.cart.title}
        </Link>

        <header className="cx-greeting" data-motion="head">
          <h1 className="cx-greeting__name">{t.checkout.title}</h1>
          <p className="cx-greeting__sub">{t.checkout.subtitle}</p>
        </header>

        <div style={{ marginTop: 16 }}>
          <CheckoutForm
            locale={l}
            t={t}
            defaultEmail={user?.email ?? null}
            balance={Number(user?.profile?.balance ?? 0)}
            defaultWhatsapp={lastWhatsapp}
            defaultName={user?.profile?.full_name ?? null}
          />
        </div>
      </main>
    </div>
  );
}
