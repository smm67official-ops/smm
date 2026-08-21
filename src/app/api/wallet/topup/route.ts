import { NextResponse, type NextRequest } from 'next/server';
import { getSessionUser } from '@/lib/auth';
import {
  TOPUP_MAX,
  TOPUP_MAX_PENDING,
  TOPUP_MIN,
  countPendingTopUps,
  createTopUpRequest,
  validateTopUpAmount,
} from '@/lib/topup';
import { isValidWhatsApp, normalizeWhatsApp } from '@/lib/whatsapp';

export const dynamic = 'force-dynamic';

const MESSAGES: Record<string, string> = {
  INVALID_AMOUNT: 'Enter a valid amount.',
  AMOUNT_TOO_LOW: `The minimum top-up is $${TOPUP_MIN}.`,
  AMOUNT_TOO_HIGH: `The maximum top-up is $${TOPUP_MAX}.`,
};

/**
 * Enregistre une demande de recharge.
 *
 * Aucune écriture sur le solde : la demande est une intention. Le crédit
 * n'a lieu qu'à l'approbation, côté administration, via `wallet_apply`.
 * Cette route est donc sans effet financier — elle ne peut pas être
 * détournée pour s'auto-créditer.
 */
export async function POST(request: NextRequest) {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: 'Sign in to top up your wallet.' }, { status: 401 });
  }

  let body: { amount?: unknown; whatsapp?: string; note?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const validation = validateTopUpAmount(body.amount);
  if (!validation.ok) {
    return NextResponse.json(
      { error: MESSAGES[validation.error] ?? 'Invalid amount.', code: validation.error },
      { status: 400 }
    );
  }

  // Le numéro est facultatif : sans lui, la conversation WhatsApp part du
  // compte du client. S'il est fourni, il doit être exploitable.
  let whatsapp: string | null = null;
  if (body.whatsapp?.trim()) {
    if (!isValidWhatsApp(body.whatsapp)) {
      return NextResponse.json({ error: 'Enter a valid WhatsApp number.' }, { status: 400 });
    }
    whatsapp = normalizeWhatsApp(body.whatsapp);
  }

  // Empêche l'empilement de demandes identiques : la file d'attente de
  // l'administration deviendrait illisible et le client ne saurait plus
  // laquelle est en cours.
  const pending = await countPendingTopUps(user.id);
  if (pending >= TOPUP_MAX_PENDING) {
    return NextResponse.json(
      {
        error: `You already have ${pending} top-up requests awaiting confirmation.`,
        code: 'TOO_MANY_PENDING',
      },
      { status: 409 }
    );
  }

  const created = await createTopUpRequest({
    userId: user.id,
    amount: validation.amount,
    email: user.email,
    whatsapp,
    note: body.note?.trim().slice(0, 500) || null,
  });

  if (!created.ok) {
    return NextResponse.json(
      { error: 'Could not record the request.', detail: created.message },
      { status: 500 }
    );
  }

  return NextResponse.json({
    ok: true,
    request: {
      id: created.request.id,
      amount: Number(created.request.amount),
      status: created.request.status,
      created_at: created.request.created_at,
    },
  });
}
