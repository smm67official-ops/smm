import { redirect } from 'next/navigation';
import { Icon } from '@/design-system';
import PaymentMethods from '@/components/admin/PaymentMethods';
import WhatsAppNumbers from '@/components/admin/WhatsAppNumbers';
import { requireAdmin } from '@/lib/auth';
import { listPaymentMethods, listWhatsAppNumbers } from '@/lib/settings';

/**
 * Paramètres du panel.
 *
 * `force-dynamic` : ces réglages pilotent ce que voit le client. Une page
 * mise en cache afficherait un numéro ou un moyen de paiement déjà
 * retiré, et l'administrateur croirait sa modification perdue.
 */
export const dynamic = 'force-dynamic';

type Params = Promise<{ locale: string }>;

export default async function AdminParametersPage({ params }: { params: Params }) {
  const auth = await requireAdmin();
  const { locale } = await params;
  if (!auth.ok) redirect(`/${locale}/admin/login`);

  const [numbers, methods] = await Promise.all([
    listWhatsAppNumbers(),
    listPaymentMethods(false),
  ]);

  const active = numbers.find((n) => n.is_active) ?? null;
  const activeMethods = methods.filter((m) => m.is_active).length;

  return (
    <div className="gp-page">
      <header className="gp-hero">
        <div className="gp-hero__glow" aria-hidden="true" />
        <div className="gp-hero__main">
          <div className="gp-hero__brand">
            <span className="gp-icon-mark" aria-hidden="true">
              <Icon name="shield" size={22} />
            </span>
            <div>
              <p className="gp-hero__eyebrow">Configuration</p>
              <h2 className="gp-hero__title">Parameters</h2>
              <p className="gp-hero__desc">
                Contact number and payment methods. Nothing here is hard-coded in the site: what you
                set applies to clients straight away.
              </p>
            </div>
          </div>
        </div>
      </header>

      <div className="gp-stage">
        <div className="gp-stat-grid gp-stat-grid--3" data-reveal>
          <article className="gp-stat-card" data-reveal-item data-hover="lift">
            <span className="gp-icon-mark gp-icon-mark--stat gp-icon-mark--green" aria-hidden="true">
              <Icon name="check" size={19} />
            </span>
            <div className="gp-stat-card__body">
              <p className="gp-stat-card__label">Active WhatsApp</p>
              <p className="gp-stat-card__value">{active ? active.label : 'None'}</p>
            </div>
          </article>

          <article className="gp-stat-card" data-reveal-item data-hover="lift">
            <span className="gp-icon-mark gp-icon-mark--stat gp-icon-mark--blue" aria-hidden="true">
              <Icon name="card" size={19} />
            </span>
            <div className="gp-stat-card__body">
              <p className="gp-stat-card__label">Methods shown to clients</p>
              <p className="gp-stat-card__value">{activeMethods}</p>
            </div>
          </article>

          <article className="gp-stat-card" data-reveal-item data-hover="lift">
            <span className="gp-icon-mark gp-icon-mark--stat gp-icon-mark--violet" aria-hidden="true">
              <Icon name="grid" size={19} />
            </span>
            <div className="gp-stat-card__body">
              <p className="gp-stat-card__label">Methods configured</p>
              <p className="gp-stat-card__value">{methods.length}</p>
            </div>
          </article>
        </div>

        <WhatsAppNumbers numbers={numbers} />
        <PaymentMethods methods={methods} />
      </div>
    </div>
  );
}
