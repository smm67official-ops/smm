'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import type { Locale } from '@/i18n/config';
import type { Dictionary } from '@/i18n';

export default function RegisterForm({ locale, t }: { locale: Locale; t: Dictionary }) {
  const router = useRouter();

  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [acceptTerms, setAcceptTerms] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!acceptTerms) {
      setError(t.auth.termsRequired);
      return;
    }
    if (password.length < 6) {
      setError(t.auth.passwordTooShort);
      return;
    }

    setLoading(true);
    const supabase = createClient();
    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || window.location.origin;

    const { data, error } = await supabase.auth.signUp({
      email: email.trim(),
      password,
      options: {
        data: { username: username.trim() },
        emailRedirectTo: `${siteUrl}/auth/callback?next=/${locale}/account`,
      },
    });

    setLoading(false);

    if (error) {
      setError(error.message);
      return;
    }

    // Sans confirmation d'e-mail, Supabase ouvre directement la session.
    if (data.session) {
      router.push(`/${locale}/account`);
      router.refresh();
      return;
    }

    setNotice(t.auth.confirmNotice);
  };

  return (
    <form className="tm-form tm-register-form" onSubmit={onSubmit}>
      <h4>{t.auth.registerTitle}</h4>
      <p>{t.auth.registerSubtitle}</p>

      {error && <p className="tm-alert tm-alert-error">{error}</p>}
      {notice && <p className="tm-alert tm-alert-success">{notice}</p>}

      <div className="tm-form-inner">
        <div className="tm-form-field">
          <label htmlFor="register-username">{t.auth.username}</label>
          <input
            type="text"
            id="register-username"
            required
            autoComplete="username"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
          />
        </div>
        <div className="tm-form-field">
          <label htmlFor="register-email">{t.auth.email}</label>
          <input
            type="email"
            id="register-email"
            required
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </div>
        <div className="tm-form-field">
          <label htmlFor="register-password">{t.auth.password}</label>
          <input
            type={showPassword ? 'text' : 'password'}
            id="register-password"
            required
            minLength={6}
            autoComplete="new-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </div>
        <div className="tm-form-field">
          <div>
            <input
              type="checkbox"
              id="register-pass-show"
              checked={showPassword}
              onChange={(e) => setShowPassword(e.target.checked)}
            />
            <label htmlFor="register-pass-show">{t.auth.showPassword}</label>
          </div>
          <div>
            <input
              type="checkbox"
              id="register-terms"
              checked={acceptTerms}
              onChange={(e) => setAcceptTerms(e.target.checked)}
            />
            <label htmlFor="register-terms">
              {t.auth.acceptTerms} <Link href={`/${locale}/contact`}>→</Link>
            </label>
          </div>
        </div>
        <div className="tm-form-field">
          <button type="submit" className="tm-button" disabled={loading}>
            {loading && <span className="mx-spinner" aria-hidden="true" />}
            {loading ? t.auth.registering : t.auth.register}
          </button>
        </div>
      </div>
    </form>
  );
}
