'use client';

import { useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import type { Dictionary } from '@/i18n';

export default function ContactForm({ t }: { t: Dictionary }) {
  const [form, setForm] = useState({ name: '', email: '', subject: '', message: '' });
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const set =
    (key: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
      setForm((f) => ({ ...f, [key]: e.target.value }));

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setResult(null);

    const supabase = createClient();
    const { error } = await supabase.from('contact_messages').insert({
      name: form.name.trim(),
      email: form.email.trim(),
      subject: form.subject.trim(),
      message: form.message.trim(),
    });

    setLoading(false);

    if (error) {
      setResult({ type: 'error', text: error.message });
      return;
    }

    setResult({ type: 'success', text: t.contact.sent });
    setForm({ name: '', email: '', subject: '', message: '' });
  };

  return (
    <form className="tm-contact-forminner tm-form" onSubmit={onSubmit}>
      {result && (
        <p className={`tm-alert tm-alert-${result.type === 'error' ? 'error' : 'success'}`}>
          {result.text}
        </p>
      )}

      <div className="tm-form-inner">
        <div className="tm-form-field tm-form-fieldhalf">
          <label htmlFor="contact-name">{t.contact.name} *</label>
          <input id="contact-name" type="text" required value={form.name} onChange={set('name')} />
        </div>
        <div className="tm-form-field tm-form-fieldhalf">
          <label htmlFor="contact-email">{t.contact.email} *</label>
          <input id="contact-email" type="email" required value={form.email} onChange={set('email')} />
        </div>
        <div className="tm-form-field">
          <label htmlFor="contact-subject">{t.contact.subject}</label>
          <input id="contact-subject" type="text" value={form.subject} onChange={set('subject')} />
        </div>
        <div className="tm-form-field">
          <label htmlFor="contact-message">{t.contact.message} *</label>
          <textarea id="contact-message" rows={6} required value={form.message} onChange={set('message')} />
        </div>
        <div className="tm-form-field">
          <button type="submit" className="tm-button" disabled={loading}>
            {loading && <span className="mx-spinner" aria-hidden="true" />}
            {loading ? t.contact.sending : t.contact.send}
          </button>
        </div>
      </div>
    </form>
  );
}
