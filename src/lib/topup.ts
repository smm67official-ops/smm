import 'server-only';
import { createAdminClient } from '@/lib/supabase/admin';
import { walletApply } from '@/lib/wallet';
import type { AdminTopUpRequest, TopUpRequest } from '@/lib/supabase/types';

/**
 * Demandes de recharge.
 *
 * Le panel ne dispose d'aucun encaissement automatique : une recharge est
 * confirmée manuellement. Cette couche garde deux invariants :
 *
 *  - une demande ne crédite jamais elle-même un portefeuille ; seule
 *    `wallet_apply` écrit dans le grand livre ;
 *  - une demande déjà tranchée ne peut pas l'être une seconde fois, ce
 *    qui rend le double crédit impossible même si l'administrateur
 *    clique deux fois.
 */

/** Bornes de saisie, exprimées dans la devise du panel. */
export const TOPUP_MIN = 1;
export const TOPUP_MAX = 5000;

/** Au-delà, la file d'attente n'est plus lisible et le client s'y perd. */
export const TOPUP_MAX_PENDING = 3;

/**
 * Bonus promotionnel annoncé sur la page d'accueil.
 *
 * Calculé ici et nulle part ailleurs : le client ne l'envoie jamais, il
 * est déduit du montant à la création de la demande, puis figé dans la
 * ligne. Le crédit à l'approbation additionne montant et bonus, donc la
 * promesse faite au visiteur est celle qui arrive dans le portefeuille.
 */
export const TOPUP_BONUS_THRESHOLD = 100;
export const TOPUP_BONUS_RATE = 0.05;

export function bonusFor(amount: number): number {
  if (!Number.isFinite(amount) || amount < TOPUP_BONUS_THRESHOLD) return 0;
  return Math.round(amount * TOPUP_BONUS_RATE * 100) / 100;
}

export type TopUpValidation = { ok: true; amount: number } | { ok: false; error: string };

/** Contrôle partagé par le formulaire et la route : une seule vérité. */
export function validateTopUpAmount(input: unknown): TopUpValidation {
  const amount = Number(input);

  if (!Number.isFinite(amount) || amount <= 0) {
    return { ok: false, error: 'INVALID_AMOUNT' };
  }
  if (amount < TOPUP_MIN) return { ok: false, error: 'AMOUNT_TOO_LOW' };
  if (amount > TOPUP_MAX) return { ok: false, error: 'AMOUNT_TOO_HIGH' };

  // Deux décimales : au-delà, le montant annoncé et le montant crédité
  // divergeraient à l'affichage.
  return { ok: true, amount: Math.round(amount * 100) / 100 };
}

export async function countPendingTopUps(userId: string): Promise<number> {
  const admin = createAdminClient();
  const { count } = await admin
    .from('topup_requests')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId)
    .eq('status', 'pending');

  return count ?? 0;
}

export async function createTopUpRequest(input: {
  userId: string;
  amount: number;
  email?: string | null;
  whatsapp?: string | null;
  note?: string | null;
  method?: 'whatsapp' | 'manual' | 'online';
}): Promise<{ ok: true; request: TopUpRequest } | { ok: false; message: string }> {
  const admin = createAdminClient();

  const { data, error } = await admin
    .from('topup_requests')
    .insert({
      user_id: input.userId,
      amount: input.amount,
      bonus: bonusFor(input.amount),
      email: input.email ?? null,
      whatsapp: input.whatsapp ?? null,
      note: input.note ?? null,
      method: input.method ?? 'whatsapp',
      status: 'pending',
    })
    .select('*')
    .single();

  // Le message est remonté tel quel : une table absente (migration non
  // appliquée) doit se diagnostiquer sans fouiller les journaux.
  if (error) return { ok: false, message: error.message };
  return { ok: true, request: data as TopUpRequest };
}

export async function listTopUpRequests(userId: string, limit = 20): Promise<TopUpRequest[]> {
  const admin = createAdminClient();
  const { data } = await admin
    .from('topup_requests')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(limit);

  return (data ?? []) as TopUpRequest[];
}

export async function listAdminTopUpRequests(
  status: 'pending' | 'all' = 'pending',
  limit = 100
): Promise<AdminTopUpRequest[]> {
  const admin = createAdminClient();

  let query = admin
    .from('admin_topup_requests')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(limit);

  if (status === 'pending') query = query.eq('status', 'pending');

  const { data } = await query;
  return (data ?? []) as AdminTopUpRequest[];
}

export type SettleResult =
  | { ok: true; balance: number }
  | { ok: false; code: 'NOT_FOUND' | 'ALREADY_SETTLED' | 'WALLET_ERROR'; message: string };

/**
 * Tranche une demande.
 *
 * L'approbation passe par `wallet_apply`, puis marque la demande. Le
 * verrouillage repose sur l'`UPDATE ... where status = 'pending'` : si
 * deux administrateurs approuvent en même temps, le second ne trouve
 * plus de ligne à mettre à jour et on n'a crédité qu'une fois.
 */
export async function settleTopUpRequest(input: {
  id: string;
  decision: 'approved' | 'rejected';
  actorId: string;
  reviewNote?: string | null;
}): Promise<SettleResult> {
  const admin = createAdminClient();

  /*
    1. Réservation.

    Le statut n'est PAS encore modifié : on pose seulement `reviewed_by`.
    C'est la condition `reviewed_by is null` qui sérialise deux clics
    simultanés — le second UPDATE ne trouve plus de ligne. Marquer
    « approuvée » dès maintenant serait un mensonge tant que le crédit
    n'a pas eu lieu, et le trigger `protect_topup_status` interdirait de
    revenir en arrière.
  */
  const { data: claimed, error: claimError } = await admin
    .from('topup_requests')
    .update({ reviewed_by: input.actorId, reviewed_at: new Date().toISOString() })
    .eq('id', input.id)
    .eq('status', 'pending')
    .is('reviewed_by', null)
    .select('*')
    .maybeSingle();

  if (claimError) {
    return { ok: false, code: 'WALLET_ERROR', message: claimError.message };
  }
  if (!claimed) {
    return { ok: false, code: 'ALREADY_SETTLED', message: 'Request already settled.' };
  }

  const request = claimed as TopUpRequest;

  /** Libère la réservation : la demande retourne dans la file. */
  const release = () =>
    admin
      .from('topup_requests')
      .update({ reviewed_by: null, reviewed_at: null })
      .eq('id', request.id);

  const currentBalance = async () => {
    const { data } = await admin
      .from('profiles')
      .select('balance')
      .eq('id', request.user_id)
      .maybeSingle();
    return Number(data?.balance ?? 0);
  };

  // 2. Refus : aucun mouvement de portefeuille.
  if (input.decision === 'rejected') {
    const { error } = await admin
      .from('topup_requests')
      .update({ status: 'rejected', review_note: input.reviewNote ?? null })
      .eq('id', request.id);

    if (error) {
      await release();
      return { ok: false, code: 'WALLET_ERROR', message: error.message };
    }

    return { ok: true, balance: await currentBalance() };
  }

  // 3. Crédit effectif, seul écrivain autorisé du solde.
  //    Le bonus est versé dans le même mouvement : deux écritures
  //    laisseraient une fenêtre où seul le montant de base est crédité.
  const bonus = Number(request.bonus ?? 0);
  const credited = Number(request.amount) + bonus;

  const credit = await walletApply({
    userId: request.user_id,
    type: 'CREDIT',
    amount: credited,
    reason: bonus > 0
      ? `Top-up request ${request.id.slice(0, 8)} (incl. ${bonus} bonus)`
      : `Top-up request ${request.id.slice(0, 8)}`,
    actorId: input.actorId,
  });

  if (!credit.ok) {
    await release();
    return { ok: false, code: 'WALLET_ERROR', message: credit.message };
  }

  // 4. Le mouvement existe : la demande peut enfin être close.
  await admin
    .from('topup_requests')
    .update({
      status: 'approved',
      review_note: input.reviewNote ?? null,
      transaction_id: credit.transaction.id,
    })
    .eq('id', request.id);

  return { ok: true, balance: Number(credit.transaction.balance_after) };
}
