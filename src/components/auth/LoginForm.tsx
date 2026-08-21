'use client';

import { useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import type { Locale } from '@/i18n/config';
import type { Dictionary } from '@/i18n';

export default function LoginForm({ locale, t }: { locale: Locale; t: Dictionary }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirectTo = searchParams.get('redirect') || `/${locale}/account`;
  const justRegistered = searchParams.get('registered') === '1';

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const supabase = createClient();
    const { error } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    });

    if (error) {
      setError(error.message);
      setLoading(false);
      return;
    }

    // `refresh()` force les Server Components à relire la session.
    router.push(redirectTo);
    router.refresh();
  };

  return (
    <form className="tm-form tm-login-form" onSubmit={onSubmit}>
      <h4>{t.auth.loginTitle}</h4>
      <p>{t.auth.loginSubtitle}</p>

      {justRegistered && <p className="tm-alert tm-alert-success">{t.auth.registeredNotice}</p>}
      {error && <p className="tm-alert tm-alert-error">{error}</p>}

      <div className="tm-form-inner">
        <div className="tm-form-field">
          <label htmlFor="login-email">{t.auth.email} *</label>
          <input
            type="email"
            id="login-email"
            required
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </div>
        <div className="tm-form-field">
          <label htmlFor="login-password">{t.auth.password} *</label>
          <input
            type="password"
            id="login-password"
            required
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </div>
        <div className="tm-form-field">
          <input type="checkbox" name="login-remember" id="login-remember" defaultChecked />
          <label htmlFor="login-remember">{t.auth.remember}</label>
          <p className="mb-0">
            <a href={`/${locale}/forgot-password`}>{t.auth.forgot}</a>
          </p>
        </div>
        <div className="tm-form-field">
          <button type="submit" className="tm-button" disabled={loading}>
            {loading && <span className="mx-spinner" aria-hidden="true" />}
            {loading ? t.auth.loggingIn : t.auth.login}
          </button>
        </div>
      </div>
    </form>
  );
}
