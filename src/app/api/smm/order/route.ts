import { NextResponse, type NextRequest } from 'next/server';
import { SmmGen, SmmGenError, priceFor, validateOrder } from '@/lib/smmgen';
import { createAdminClient } from '@/lib/supabase/admin';
import { createClient } from '@/lib/supabase/server';
import { classifyProviderError, PROVIDER_ERROR_MESSAGE } from '@/lib/orders';
import { getBalance, walletApply } from '@/lib/wallet';
import { isAutoSubmitEnabled } from '@/lib/settings';
import { isValidWhatsApp, normalizeWhatsApp } from '@/lib/whatsapp';
import type { Service } from '@/lib/supabase/types';

export const dynamic = 'force-dynamic';

type IncomingItem = {
  serviceId: string;
  link?: string;
  quantity?: number;
  extras?: Record<string, string | number>;
};

type Payload = {
  items: IncomingItem[];
  idempotencyKey?: string;
  first_name?: string;
  last_name?: string;
  phone?: string;
  whatsapp?: string;
  country?: string;
  note?: string;
};

const fail = (error: string, status: number, extra?: Record<string, unknown>) =>
  NextResponse.json({ error, ...extra }, { status });

/**
 * Création d'une commande.
 *
 * - authentification obligatoire (une commande doit être rattachée à un compte) ;
 * - le prix n'est JAMAIS lu depuis le navigateur, il est recalculé ici ;
 * - `idempotencyKey` empêche les doublons en cas de rejeu (l'API fournisseur
 *   n'a aucune clé d'idempotence, cf. SMMGenAPIReference.md §10.8) ;
 * - le numéro WhatsApp est obligatoire : il sert à finaliser la commande ;
 * - le portefeuille est débité de façon atomique (verrou de ligne dans
 *   `wallet_apply`), ce qui exclut la double dépense ;
 * - l'envoi fournisseur n'a lieu que si SMM_AUTO_SUBMIT=true.
 */
export async function POST(request: NextRequest) {
  let payload: Payload;
  try {
    payload = (await request.json()) as Payload;
  } catch {
    return fail('Invalid JSON body', 400);
  }

  if (!Array.isArray(payload.items) || payload.items.length === 0) {
    return fail('Empty order', 400);
  }

  // L'authentification est contrôlée en premier : sans session, tout autre
  // message d'erreur serait trompeur pour l'utilisateur.
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return fail('You must be signed in to place an order.', 401);

  if (!payload.whatsapp || !isValidWhatsApp(payload.whatsapp)) {
    return fail('A valid WhatsApp number is required to complete the order.', 400);
  }

  const whatsapp = normalizeWhatsApp(payload.whatsapp);

  const admin = createAdminClient();

  // 1. Rejeu : une clé déjà utilisée renvoie la commande existante.
  if (payload.idempotencyKey) {
    const { data: existing } = await admin
      .from('orders')
      .select('id, total, status')
      .eq('idempotency_key', payload.idempotencyKey)
      .maybeSingle();

    if (existing) {
      return NextResponse.json({ ok: true, orderId: existing.id, total: existing.total, duplicate: true });
    }
  }

  // 2. Relecture des services en base.
  const serviceIds = [...new Set(payload.items.map((i) => i.serviceId))];
  const { data: services, error: servicesError } = await admin
    .from('services')
    .select('*')
    .in('id', serviceIds);

  if (servicesError) return fail(servicesError.message, 500);

  const byId = new Map((services as Service[] | null)?.map((s) => [s.id, s]) ?? []);

  const lines = [];
  for (const item of payload.items) {
    const service = byId.get(item.serviceId);
    if (!service) return fail(`Unknown service ${item.serviceId}`, 400);
    if (!service.is_active) return fail(`Service unavailable: ${service.name}`, 400);

    const needsQuantity = service.type !== 'Package';
    const quantity = needsQuantity ? Number(item.quantity ?? 0) : service.min;

    if (needsQuantity && (!Number.isFinite(quantity) || quantity < service.min || quantity > service.max)) {
      return fail(
        `Quantity for "${service.name}" must be between ${service.min} and ${service.max}`,
        400
      );
    }

    if (service.type !== 'Subscriptions' && !item.link?.trim()) {
      return fail(`A target link is required for "${service.name}"`, 400);
    }

    const fields: Record<string, string | number> = {
      service: service.provider_service_id,
      ...(item.link ? { link: item.link.trim() } : {}),
      ...(needsQuantity ? { quantity } : {}),
      ...(item.extras ?? {}),
    };

    try {
      validateOrder(service.type, fields);
    } catch (e) {
      return fail((e as Error).message, 400);
    }

    lines.push({
      service,
      fields,
      quantity,
      charge: priceFor(service.rate, quantity),
      link: item.link?.trim() ?? null,
      extras: item.extras ?? {},
    });
  }

  const total = lines.reduce((sum, l) => sum + l.charge, 0);

  // 3. Écriture de la commande.
  const { data: order, error: orderError } = await admin
    .from('orders')
    .insert({
      user_id: user.id,
      status: 'pending',
      total,
      email: user.email ?? '',
      first_name: payload.first_name ?? null,
      last_name: payload.last_name ?? null,
      phone: payload.phone ?? null,
      whatsapp,
      country: payload.country ?? null,
      note: payload.note ?? null,
      idempotency_key: payload.idempotencyKey ?? null,
    })
    .select('id')
    .single();

  if (orderError || !order) {
    // 23505 = collision d'idempotence entre deux requêtes concurrentes.
    if (orderError?.code === '23505' && payload.idempotencyKey) {
      const { data: existing } = await admin
        .from('orders')
        .select('id, total')
        .eq('idempotency_key', payload.idempotencyKey)
        .maybeSingle();
      if (existing) {
        return NextResponse.json({ ok: true, orderId: existing.id, total: existing.total, duplicate: true });
      }
    }
    return fail(orderError?.message ?? 'Order could not be saved', 500);
  }

  // 4. Débit du portefeuille — opération atomique.
  //
  //    `wallet_apply` verrouille la ligne de profil, contrôle le solde,
  //    met à jour `profiles.balance` et écrit le grand livre dans une
  //    seule transaction. Deux commandes simultanées sont sérialisées.
  //
  //    Si le débit échoue, la commande qui vient d'être créée est
  //    supprimée : elle n'a encore ni ligne ni envoi fournisseur, donc
  //    aucune trace ne subsiste.
  const debit = await walletApply({
    userId: user.id,
    type: 'DEBIT',
    amount: total,
    reason: `Order ${order.id.slice(0, 8)}`,
    orderId: order.id,
    actorId: user.id,
  });

  if (!debit.ok) {
    await admin.from('orders').delete().eq('id', order.id);

    if (debit.code === 'INSUFFICIENT_FUNDS') {
      const { data: profile } = await admin
        .from('profiles')
        .select('balance')
        .eq('id', user.id)
        .maybeSingle();

      return fail('Insufficient wallet balance for this order.', 402, {
        code: 'INSUFFICIENT_FUNDS',
        balance: Number(profile?.balance ?? 0),
        required: total,
      });
    }

    return fail('The wallet could not be debited. No order was created.', 500, { code: debit.code });
  }

  // 5. Envoi fournisseur (désactivé par défaut).
  /*
    L'interrupteur vit dans les réglages, plus dans l'environnement :
    le basculer ne demande plus de redéploiement, et son état est
    visible dans le back-office.
  */
  const autoSubmit = await isAutoSubmitEnabled();
  const provider = autoSubmit ? new SmmGen() : null;

  let submitted = 0;
  let failedLines = 0;
  let lastError: string | null = null;

  /*
    Montant des lignes que le fournisseur a refusées.

    Le portefeuille est débité AVANT l'envoi — c'est ce qui empêche la
    double dépense. Mais une ligne refusée ne sera jamais livrée : garder
    l'argent reviendrait à facturer un service qui n'existera pas. On
    cumule donc ici de quoi rembourser exactement ce qui a échoué, ni
    plus ni moins.
  */
  let failedCharge = 0;

  const itemRows = [];
  for (const line of lines) {
    let providerOrderId: number | null = null;
    let status = 'pending';
    let providerError: string | null = null;

    if (provider) {
      try {
        const result = await provider.addOrder(line.fields);
        providerOrderId = Number(result.order);
        status = 'processing';
        submitted += 1;
      } catch (e) {
        const raw = e instanceof SmmGenError ? e.message : String(e);
        providerError = PROVIDER_ERROR_MESSAGE[classifyProviderError(raw)];
        lastError = providerError;
        status = 'failed';
        failedLines += 1;
        failedCharge += Number(line.charge);
      }
    }

    itemRows.push({
      order_id: order.id,
      service_id: line.service.id,
      provider_service_id: line.service.provider_service_id,
      service_name: line.service.name,
      link: line.link,
      quantity: line.quantity,
      rate: line.service.rate,
      charge: line.charge,
      extras: line.extras,
      provider_order_id: providerOrderId,
      provider_error: providerError,
      status,
    });
  }

  const { error: itemsError } = await admin.from('order_items').insert(itemRows);
  if (itemsError) {
    // Le portefeuille a déjà été débité : on rembourse avant de sortir.
    await walletApply({
      userId: user.id,
      type: 'REFUND',
      amount: total,
      reason: `Failed order ${order.id.slice(0, 8)} — items could not be saved`,
      orderId: order.id,
      actorId: user.id,
    });
    return fail(itemsError.message, 500, { orderId: order.id, refunded: true });
  }

  /*
    Remboursement des lignes refusées.

    Sans cela, un fournisseur à court de fonds — ou une clé invalide —
    encaissait le client pour rien : la commande passait en « failed » et
    l'argent restait débité. Le cas se produit dès la première commande
    si le solde SMMGen est à zéro.

    Le remboursement suit le grand livre comme tout mouvement : il est
    tracé, et le solde reste reconstituable.
  */
  let refunded = 0;

  if (failedCharge > 0) {
    const refund = await walletApply({
      userId: user.id,
      type: 'REFUND',
      amount: Math.round(failedCharge * 100000) / 100000,
      reason:
        failedLines === lines.length
          ? `Order ${order.id.slice(0, 8)} rejected by provider`
          : `Order ${order.id.slice(0, 8)} — ${failedLines}/${lines.length} line(s) rejected`,
      orderId: order.id,
      actorId: user.id,
    });

    // Un remboursement en échec ne doit pas masquer la commande : on le
    // signale pour qu'un administrateur reprenne la main.
    if (refund.ok) refunded = Number(refund.transaction.amount);
    else console.error('[smm/order] remboursement impossible', order.id, refund.message);
  }

  // 6. Statut global de la commande.
  const orderStatus =
    !provider ? 'pending' : failedLines === lines.length ? 'failed' : submitted > 0 ? 'processing' : 'pending';

  await admin
    .from('orders')
    .update({
      status: orderStatus,
      provider_error: lastError,
      submitted_at: provider ? new Date().toISOString() : null,
    })
    .eq('id', order.id);

  await admin.from('order_events').insert({
    order_id: order.id,
    from_status: null,
    to_status: orderStatus,
    source: 'system',
    actor_id: user.id,
    note: provider
      ? `Submitted ${submitted}/${lines.length} line(s) to provider` +
        (refunded > 0 ? ` — refunded $${refunded.toFixed(4)}` : '')
      : 'Provider submission disabled',
  });

  return NextResponse.json({
    ok: true,
    orderId: order.id,
    total,
    status: orderStatus,
    submitted: autoSubmit,
    providerError: lastError,
    refunded,
    // Solde après remboursement éventuel, pas celui d'avant : l'écran
    // afficherait sinon un montant déjà faux.
    balance: refunded > 0 ? await getBalance(user.id) : debit.transaction.balance_after,
  });
}
