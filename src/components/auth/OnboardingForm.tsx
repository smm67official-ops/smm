'use client';

import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import {
  ONBOARDING_MESSAGE,
  ONBOARDING_PLATFORMS,
  validateOnboarding,
} from '@/lib/onboarding';
import type { Locale } from '@/i18n/config';
import type { Dictionary } from '@/i18n';

/**
 * Dernière étape avant l'ouverture du compte.
 *
 * Deux questions, pas une de plus. Chacune sert immédiatement : le numéro
 * WhatsApp parce que c'est par là que passent recharges et commandes, les
 * plateformes parce qu'elles décident du catalogue affiché en premier.
 * Tout ce qui pourrait attendre le profil attend le profil.
 */
export default function OnboardingForm({
  locale,
  t,
  name,
  defaultWhatsapp,
}: {
  locale: Locale;
  t: Dictionary;
  name: string;
  defaultWhatsapp?: string | null;
}) {
  const router = useRouter();

  const [whatsapp, setWhatsapp] = useState(defaultWhatsapp ?? '');
  const [platforms, setPlatforms] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const toggle = (id: string) => {
    setError(null);
    setPlatforms((prev) => (prev.includes(id) ? prev.filter((p) => p !== id) : [...prev, id]));
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Même contrôle que le serveur, pour un retour immédiat.
    const check = validateOnboarding({ whatsapp, platforms });
    if (!check.ok) {
      setError(ONBOARDING_MESSAGE[check.error]);
      return;
    }

    setLoading(true);
    setError(null);

    const response = await fetch('/api/account/onboarding', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ whatsapp, platforms }),
    });
    const result = await response.json().catch(() => ({}));

    if (!response.ok) {
      setError(result.error ?? t.common.error);
      setLoading(false);
      return;
    }

    router.push(`/${locale}/account`);
    router.refresh();
  };

  return (
    <form className="tm-form tm-login-form tm-onboarding" onSubmit={submit}>
      <h4>{t.onboarding.title.replace('{name}', name)}</h4>
      <p>{t.onboarding.subtitle}</p>

      {error && (
        <p className="tm-alert tm-alert-error" role="alert">
          {error}
        </p>
      )}

      <div className="tm-form-inner">
        <div className="tm-form-field">
          <label htmlFor="onboarding-whatsapp">{t.onboarding.whatsappLabel} *</label>
          <input
            id="onboarding-whatsapp"
            type="tel"
            inputMode="tel"
            autoComplete="tel"
            required
            placeholder="+212 6 12 34 56 78"
            value={whatsapp}
            onChange={(e) => {
              setWhatsapp(e.target.value);
              setError(null);
            }}
          />
          <span className="tm-field-hint">{t.onboarding.whatsappHint}</span>
        </div>

        <div className="tm-form-field">
          <label>{t.onboarding.platformsLabel} *</label>
          <span className="tm-field-hint">{t.onboarding.platformsHint}</span>

          {/* Cases à cocher réelles : le clavier et les lecteurs d'écran
              les annoncent comme telles, ce qu'une grille de <div>
              cliquables ne ferait pas. */}
          <div className="tm-platformgrid">
            {ONBOARDING_PLATFORMS.map((platform) => {
              const checked = platforms.includes(platform.id);
              return (
                <label
                  key={platform.id}
                  className={`tm-platformchip${checked ? ' is-checked' : ''}`}
                >
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={() => toggle(platform.id)}
                  />
                  {platform.icon ? (
                    <Image src={platform.icon} alt="" width={22} height={22} />
                  ) : (
                    <span className="tm-platformchip__dot" aria-hidden="true">
                      {platform.label.slice(0, 1)}
                    </span>
                  )}
                  <span>{platform.label}</span>
                </label>
              );
            })}
          </div>
        </div>

        <div className="tm-form-field">
          <button type="submit" className="tm-button" disabled={loading}>
            {loading && <span className="mx-spinner" aria-hidden="true" />}
            {loading ? t.onboarding.saving : t.onboarding.submit}
          </button>
        </div>
      </div>
    </form>
  );
}
