import { NextResponse, type NextRequest } from 'next/server';
import { requireAdmin } from '@/lib/auth';
import { createAdminClient } from '@/lib/supabase/admin';
import { listPaymentMethods } from '@/lib/settings';
import { uploadPaymentIcon } from '@/lib/storage';
import { messageFor } from '@/lib/settings-validation';
import { readMethodFields } from '@/lib/payment-method-form';

export const dynamic = 'force-dynamic';

const guard = async () => {
  const auth = await requireAdmin();
  if (auth.ok) return null;
  return NextResponse.json(
    { error: auth.status === 401 ? 'Session expired' : 'Forbidden' },
    { status: auth.status }
  );
};

/** Liste complète, actifs et inactifs — c'est la vue du back-office. */
export async function GET() {
  const denied = await guard();
  if (denied) return denied;

  return NextResponse.json({ methods: await listPaymentMethods(false) });
}

export async function POST(request: NextRequest) {
  const denied = await guard();
  if (denied) return denied;

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return NextResponse.json({ error: 'Expected multipart/form-data' }, { status: 400 });
  }

  const parsed = readMethodFields(form);
  if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400 });

  let iconUrl: string | null = null;
  const icon = form.get('icon');

  if (icon instanceof File && icon.size > 0) {
    const upload = await uploadPaymentIcon(icon);
    if (!upload.ok) return NextResponse.json({ error: messageFor(upload.error) }, { status: 400 });
    iconUrl = upload.url;
  }

  const admin = createAdminClient();
  const { data, error } = await admin
    .from('payment_methods')
    .insert({ ...parsed.fields, icon_url: iconUrl })
    .select('*')
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  return NextResponse.json({ method: data }, { status: 201 });
}
