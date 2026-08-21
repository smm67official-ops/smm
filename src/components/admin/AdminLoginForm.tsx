'use client';

import { useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Alert, Button, Card, CardBody, Icon, Input } from '@/design-system';
import { createClient } from '@/lib/supabase/client';

export default function AdminLoginForm({ locale }: { locale: string }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirectTo = searchParams.get('redirect') || `/${locale}/admin`;
  const forbidden = searchParams.get('error') === 'forbidden';

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const supabase = createClient();
    const { data, error: signInError } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    });

    if (signInError || !data.user) {
      setError(signInError?.message ?? 'Sign-in failed.');
      setLoading(false);
      return;
    }

    // Le rôle est lu en base : jamais de liste d'administrateurs côté client.
    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', data.user.id)
      .maybeSingle();

    const role = profile?.role;
    if (role !== 'admin' && role !== 'support') {
      await supabase.auth.signOut();
      setError('This account does not have administrator access.');
      setLoading(false);
      return;
    }

    router.push(redirectTo);
    router.refresh();
  };

  return (
    <Card size="lg" style={{ width: '100%', maxWidth: 440 }}>
      <CardBody style={{ padding: 'var(--sv-space-8)' }}>
        <div className="sv-navbar__brand" style={{ marginBottom: 'var(--sv-space-6)' }}>
          <span className="sv-navbar__mark">
            <Icon name="shield" size={18} />
          </span>
          Admin access
        </div>

        <h2 style={{ fontSize: 'var(--sv-text-h3)' }}>Sign in</h2>
        <p className="sv-caption" style={{ marginBottom: 'var(--sv-space-6)' }}>
          Reserved for administrators. Customer accounts are rejected.
        </p>

        {forbidden && (
          <div style={{ marginBottom: 'var(--sv-space-5)' }}>
            <Alert tone="error" title="Access denied">
              Your account does not have administrator privileges.
            </Alert>
          </div>
        )}

        {error && (
          <div style={{ marginBottom: 'var(--sv-space-5)' }}>
            <Alert tone="error" title="Sign-in failed">
              {error}
            </Alert>
          </div>
        )}

        <form onSubmit={onSubmit} className="sv-stack" style={{ gap: 'var(--sv-space-5)' }}>
          <Input
            label="Email"
            type="email"
            required
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            icon={<Icon name="users" size={16} />}
          />
          <Input
            label="Password"
            type="password"
            required
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            icon={<Icon name="lock" size={16} />}
          />
          <Button type="submit" block loading={loading}>
            {loading ? 'Signing in…' : 'Sign in'}
          </Button>
        </form>
      </CardBody>
    </Card>
  );
}
