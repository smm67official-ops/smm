import { Suspense } from 'react';
import AdminLoginForm from '@/components/admin/AdminLoginForm';

type Params = Promise<{ locale: string }>;

export const metadata = { title: 'Admin login' };

export default async function AdminLoginPage({ params }: { params: Params }) {
  const { locale } = await params;

  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 'var(--sv-space-6)',
        background: 'linear-gradient(160deg, #f4f4fd 0%, #eceafe 45%, #f8f8fc 100%)',
      }}
    >
      <Suspense fallback={<p>Loading…</p>}>
        <AdminLoginForm locale={locale} />
      </Suspense>
    </div>
  );
}
