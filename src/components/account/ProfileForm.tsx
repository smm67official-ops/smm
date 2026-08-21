'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import type { Locale } from '@/i18n/config';
import type { Dictionary } from '@/i18n';

export default function ProfileForm({
  locale,
  t,
  email,
  profile,
}: {
  locale: Locale;
  t: Dictionary;
  email: string;
  profile: { id: string; full_name: string; username: string; phone: string };
}) {
  const router = useRouter();
  const [form, setForm] = useState(profile);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);

  const set = (key: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((f) => ({ ...f, [key]: e.target.value }));

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setMessage(null);

    const supabase = createClient();
    const { error } = await supabase
      .from('profiles')
      .update({
        full_name: form.full_name.trim(),
        username: form.username.trim() || null,
        phone: form.phone.trim(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', profile.id);

    setSaving(false);
    setMessage({ ok: !error, text: error ? error.message : t.account.saved });
    if (!error) router.refresh();
  };

  const signOut = async () => {
    await createClient().auth.signOut();
    router.push(`/${locale}`);
    router.refresh();
  };

  return (
    <form className="cx-card cx-stack" onSubmit={onSubmit}>
      {message && (
        <div className={`cx-alert cx-alert--${message.ok ? 'info' : 'error'}`}>
          <i className={message.ok ? 'ion-checkmark-circled' : 'ion-alert-circled'} />
          {message.text}
        </div>
      )}

      <div className="cx-field">
        <label htmlFor="p-name">{t.account.fullName}</label>
        <input id="p-name" type="text" value={form.full_name} onChange={set('full_name')} />
      </div>

      <div className="cx-field">
        <label htmlFor="p-username">{t.account.username}</label>
        <input id="p-username" type="text" value={form.username} onChange={set('username')} />
      </div>

      <div className="cx-field">
        <label htmlFor="p-phone">{t.account.phone}</label>
        <input id="p-phone" type="tel" value={form.phone} onChange={set('phone')} />
      </div>

      <div className="cx-field">
        <label htmlFor="p-email">{t.account.email}</label>
        <input id="p-email" type="email" value={email} readOnly style={{ background: '#f6f7fb' }} />
        <span className="cx-field__hint">{t.dashboard.emailLocked}</span>
      </div>

      <button
        type="submit"
        className="cx-btn cx-btn--primary"
        data-hover="raise"
        disabled={saving}
      >
        {saving && <span className="mx-spinner" aria-hidden="true" />}
        {saving ? t.account.saving : t.account.save}
      </button>

      <button type="button" className="cx-btn cx-btn--ghost" onClick={signOut}>
        <i className="ion-log-out" />
        {t.nav.logout}
      </button>
    </form>
  );
}
