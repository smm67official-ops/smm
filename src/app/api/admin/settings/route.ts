import { NextResponse, type NextRequest } from 'next/server';
import { requireAdmin } from '@/lib/auth';
import { createAdminClient } from '@/lib/supabase/admin';
import { getAppSettings } from '@/lib/settings';
import { MARGIN_MESSAGE, validateMargin } from '@/lib/pricing';
import { audit, clientIp } from '@/lib/audit';
import type { AppSettings } from '@/lib/supabase/types';

export const dynamic = 'force-dynamic';

const guard = async () => {
  const auth = await requireAdmin();
  if (auth.ok) return { auth, denied: null as null };
  return {
    auth: null,
    denied: NextResponse.json(
      { error: auth.status === 401 ? 'Session expired' : 'Forbidden', code: 'UNAUTHORIZED' },
      { status: auth.status }
    ),
  };
};

export async function GET() {
  const { auth, denied } = await guard();
  if (denied || !auth) return denied;

  return NextResponse.json({ settings: await getAppSettings() });
}

/**
 * Mise à jour des réglages.
 *
 * Le numéro WhatsApp n'est PAS modifiable ici : il vit dans
 * `whatsapp_numbers`, avec sa règle « un seul actif ». Accepter une
 * seconde écriture créerait deux sources à tenir d'accord.
 */
export async function PUT(request: NextRequest) {
  const { auth, denied } = await guard();
  if (denied || !auth) return denied;

  let body: {
    auto_submit_orders?: unknown;
    global_service_margin?: unknown;
    whatsapp_enabled?: unknown;
    whatsapp_message?: unknown;
    whatsapp_greeting?: unknown;
    whatsapp_position?: unknown;
  };

  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const patch: Partial<AppSettings> = { updated_by: auth.user.id };

  if (body.global_service_margin !== undefined) {
    const margin = validateMargin(body.global_service_margin);
    if (!margin.ok) {
      return NextResponse.json({ error: MARGIN_MESSAGE[margin.error], code: margin.error }, { status: 400 });
    }
    patch.global_service_margin = margin.margin;
  }

  /*
    Envoi automatique des commandes.

    Le réglage le plus lourd du panel : il décide si une commande part
    réellement chez le fournisseur. L'activer sans clé d'API ne
    produirait que des échecs, autant le refuser tout de suite.
  */
  if (body.auto_submit_orders !== undefined) {
    if (typeof body.auto_submit_orders !== 'boolean') {
      return NextResponse.json({ error: 'auto_submit_orders must be a boolean' }, { status: 400 });
    }
    if (body.auto_submit_orders && !process.env.SMMGEN_API_KEY) {
      return NextResponse.json(
        { error: 'SMMGEN_API_KEY is not configured — orders would all fail.' },
        { status: 409 }
      );
    }
    patch.auto_submit_orders = body.auto_submit_orders;
  }

  if (body.whatsapp_enabled !== undefined) {
    if (typeof body.whatsapp_enabled !== 'boolean') {
      return NextResponse.json({ error: 'whatsapp_enabled must be a boolean' }, { status: 400 });
    }
    patch.whatsapp_enabled = body.whatsapp_enabled;
  }

  if (body.whatsapp_position !== undefined) {
    if (body.whatsapp_position !== 'bottom-right' && body.whatsapp_position !== 'bottom-left') {
      return NextResponse.json(
        { error: 'Position must be bottom-right or bottom-left.' },
        { status: 400 }
      );
    }
    patch.whatsapp_position = body.whatsapp_position;
  }

  for (const field of ['whatsapp_message', 'whatsapp_greeting'] as const) {
    if (body[field] === undefined) continue;
    const value = typeof body[field] === 'string' ? (body[field] as string).trim() : '';
    // Un message trop long est tronqué par WhatsApp lui-même, et rend
    // l'URL difficile à ouvrir sur certains téléphones.
    if (value.length > 500) {
      return NextResponse.json({ error: 'Message is too long (500 characters max).' }, { status: 400 });
    }
    patch[field] = value || null;
  }

  if (Object.keys(patch).length === 1) {
    return NextResponse.json({ error: 'Nothing to update' }, { status: 400 });
  }

  const admin = createAdminClient();
  const { data, error } = await admin
    .from('app_settings')
    .update(patch)
    .eq('id', true)
    .select('*')
    .maybeSingle();

  if (error) {
    /*
      Nommer la BONNE migration.

      Un message générique renvoyait vers la 011 même quand la colonne
      absente venait de la 012 : on part exécuter un script déjà appliqué,
      et le problème reste entier.
    */
    if (/does not exist|schema cache/i.test(error.message)) {
      const missing = /auto_submit_orders/i.test(error.message) ? '012' : '011';
      return NextResponse.json(
        { error: `Settings need migration ${missing} — run it in the Supabase SQL editor.` },
        { status: 409 }
      );
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  await audit({
    action: 'BALANCE_ADJUSTED',
    actorId: auth.user.id,
    targetType: 'app_settings',
    metadata: { changed: Object.keys(patch).filter((k) => k !== 'updated_by') },
    ip: clientIp(request),
  });

  return NextResponse.json({ ok: true, settings: data });
}
