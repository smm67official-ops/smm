'use client';

import { useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { authCallbackUrl } from '@/lib/site-url';
import type { Locale } from '@/i18n/config';
import type { Dictionary } from '@/i18n';

export default function ForgotPasswordForm({ locale, t }: { locale: Locale; t: Dictionary }) {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const supabase = createClient();
    const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
      redirectTo: authCallbackUrl(locale),
    });

    setLoading(false);
    if (error) setError(error.message);
    else setSent(true);
  };

  return (
    <form className="tm-form tm-login-form" onSubmit={onSubmit}>
      <h4>{t.auth.forgotTitle}</h4>
      <p>{t.auth.forgotSubtitle}</p>

      {error && <p className="tm-alert tm-alert-error">{error}</p>}
      {sent && <p className="tm-alert tm-alert-success">{t.auth.resetSent}</p>}

      <div className="tm-form-inner">
        <div className="tm-form-field">
          <label htmlFor="reset-email">{t.auth.email} *</label>
          <input
            type="email"
            id="reset-email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </div>
        <div className="tm-form-field">
          <button type="submit" className="tm-button" disabled={loading}>
            {loading && <span className="mx-spinner" aria-hidden="true" />}
            {loading ? t.auth.sending : t.auth.sendReset}
          </button>
        </div>
      </div>
    </form>
  );
}
