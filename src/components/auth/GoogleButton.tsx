'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import type { Locale } from '@/i18n/config';
import type { Dictionary } from '@/i18n';

/**
 * Connexion Google.
 *
 * `redirectTo` vise `/auth/callback`, qui échange le code contre une
 * session puis complète le profil. L'origine est celle du navigateur,
 * jamais une variable d'environnement : une valeur figée au build
 * renverrait vers l'ancien domaine après un changement d'hébergement.
 */
export default function GoogleButton({
  locale,
  t,
  next,
}: {
  locale: Locale;
  t: Dictionary;
  next?: string;
}) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /*
    Le fournisseur est-il activé côté Supabase ?

    `signInWithOAuth` provoque une navigation complète : si Google n'est
    pas activé, Supabase répond directement une page JSON
    « Unsupported provider », hors de l'application — aucun message
    affiché ici ne pourrait l'intercepter.

    On interroge donc `/auth/v1/settings`, qui expose publiquement la
    liste des fournisseurs actifs, et le bouton n'apparaît que s'il mène
    quelque part. Activer Google dans le tableau de bord le fait
    apparaître sans redéploiement.
  */
  const [enabled, setEnabled] = useState<boolean | null>(null);

  useEffect(() => {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    if (!url || !key) {
      setEnabled(false);
      return;
    }

    let cancelled = false;

    fetch(`${url}/auth/v1/settings`, { headers: { apikey: key } })
      .then((r) => (r.ok ? r.json() : null))
      .then((settings) => {
        if (!cancelled) setEnabled(Boolean(settings?.external?.google));
      })
      .catch(() => {
        if (!cancelled) setEnabled(false);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const signIn = async () => {
    setLoading(true);
    setError(null);

    const target = next ?? `/${locale}/account`;
    const supabase = createClient();

    const { error: oauthError } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(target)}`,
      },
    });

    /*
      Une erreur ici signifie que la redirection n'a pas eu lieu — le
      fournisseur n'est pas activé côté Supabase, par exemple. Sans ce
      message, le bouton semblerait simplement inerte.

      Le cas « l'utilisateur annule sur l'écran Google » ne passe pas par
      ici : Google renvoie vers /auth/callback sans code, et la route
      redirige vers la connexion avec `missing_code`.
    */
    if (oauthError) {
      /*
        « provider is not enabled » veut dire que Google n'a pas été
        activé dans Supabase — rien à corriger dans le code. Le message
        brut enverrait chercher une panne applicative ; on dit où aller.
      */
      setError(
        /provider is not enabled|Unsupported provider/i.test(oauthError.message)
          ? t.auth.googleDisabled
          : oauthError.message
      );
      setLoading(false);
    }
  };

  // Tant que l'état est inconnu, on n'affiche rien : un bouton qui
  // apparaît puis disparaît ferait douter de sa disponibilité.
  if (enabled !== true) return null;

  return (
    <>
      {/* Le séparateur appartient au bouton : affichés ou masqués
          ensemble, jamais un « ou » sans rien après lui. */}
      <div className="tm-or" role="separator">
        <span>{t.auth.or}</span>
      </div>

      <button
        type="button"
        className="tm-button tm-button--google"
        onClick={() => void signIn()}
        disabled={loading}
      >
        {loading ? (
          <span className="mx-spinner" aria-hidden="true" />
        ) : (
          <svg viewBox="0 0 18 18" width="18" height="18" aria-hidden="true">
            <path fill="#4285F4" d="M17.64 9.2c0-.64-.06-1.25-.16-1.84H9v3.48h4.84a4.14 4.14 0 0 1-1.8 2.72v2.26h2.92c1.7-1.57 2.68-3.88 2.68-6.62Z" />
            <path fill="#34A853" d="M9 18c2.43 0 4.47-.8 5.96-2.18l-2.92-2.26c-.81.54-1.84.86-3.04.86-2.34 0-4.32-1.58-5.03-3.7H.96v2.33A9 9 0 0 0 9 18Z" />
            <path fill="#FBBC05" d="M3.97 10.72a5.4 5.4 0 0 1 0-3.44V4.95H.96a9 9 0 0 0 0 8.1l3.01-2.33Z" />
            <path fill="#EA4335" d="M9 3.58c1.32 0 2.5.45 3.44 1.35l2.58-2.58C13.46.89 11.43 0 9 0A9 9 0 0 0 .96 4.95l3.01 2.33C4.68 5.16 6.66 3.58 9 3.58Z" />
          </svg>
        )}
        {t.auth.google}
      </button>

      {error && (
        <p className="tm-alert tm-alert-error" role="alert">
          {error}
        </p>
      )}
    </>
  );
}
