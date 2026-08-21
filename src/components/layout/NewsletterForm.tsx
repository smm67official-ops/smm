'use client';

import { useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import type { Dictionary } from '@/i18n';

export default function NewsletterForm({ t }: { t: Dictionary }) {
  const [email, setEmail] = useState('');
  const [state, setState] = useState<'idle' | 'loading' | 'done' | 'error'>('idle');
  const [message, setMessage] = useState('');

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) return;

    setState('loading');
    const supabase = createClient();
    const { error } = await supabase
      .from('newsletter_subscribers')
      .insert({ email: email.trim().toLowerCase() });

    if (error) {
      // 23505 = doublon : l'adresse est déjà inscrite, ce n'est pas un échec.
      if (error.code === '23505') {
        setState('done');
        setMessage(t.footer.alreadySubscribed);
      } else {
        setState('error');
        setMessage(error.message);
      }
      return;
    }

    setState('done');
    setMessage(t.footer.subscribed);
    setEmail('');
  };

  return (
    <>
      <form className="widget-newsletter-form" onSubmit={onSubmit}>
        <input
          type="email"
          required
          placeholder={t.footer.newsletterPlaceholder}
          value={email}
          aria-label={t.footer.newsletterPlaceholder}
          onChange={(e) => setEmail(e.target.value)}
        />
        <button type="submit" className="tm-button" disabled={state === 'loading'}>
          {state === 'loading' && <span className="mx-spinner" aria-hidden="true" />}
          {state === 'loading' ? t.footer.subscribing : t.footer.subscribe} <b />
        </button>
      </form>
      {message && (
        <p className={state === 'error' ? 'tm-alert tm-alert-error' : 'tm-alert tm-alert-success'}>
          {message}
        </p>
      )}
    </>
  );
}
