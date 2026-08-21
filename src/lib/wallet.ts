import 'server-only';
import { createAdminClient } from '@/lib/supabase/admin';
import type { WalletTransaction, WalletTransactionType } from '@/lib/supabase/types';

/**
 * Application d'un mouvement de portefeuille.
 *
 * Toute la logique (verrou de ligne, contrôle de solde, écriture du grand
 * livre) vit dans la fonction PostgreSQL `wallet_apply` : elle s'exécute
 * dans une seule transaction, ce qui rend la double dépense impossible même
 * si deux commandes arrivent en parallèle.
 */
export type WalletApplyInput = {
  userId: string;
  type: WalletTransactionType;
  amount: number;
  reason?: string | null;
  orderId?: string | null;
  actorId?: string | null;
};

export type WalletApplyResult =
  | { ok: true; transaction: WalletTransaction }
  | { ok: false; code: 'INSUFFICIENT_FUNDS' | 'UNKNOWN_WALLET' | 'INVALID_AMOUNT' | 'ERROR'; message: string };

const CODES = ['INSUFFICIENT_FUNDS', 'UNKNOWN_WALLET', 'INVALID_AMOUNT', 'UNKNOWN_TYPE'] as const;

export async function walletApply(input: WalletApplyInput): Promise<WalletApplyResult> {
  const admin = createAdminClient();

  const { data, error } = await admin.rpc('wallet_apply', {
    p_user_id: input.userId,
    p_type: input.type,
    p_amount: input.amount,
    p_reason: input.reason ?? null,
    p_order_id: input.orderId ?? null,
    p_actor_id: input.actorId ?? null,
  });

  if (error) {
    const matched = CODES.find((code) => error.message.includes(code));
    return {
      ok: false,
      code: matched === 'UNKNOWN_TYPE' ? 'INVALID_AMOUNT' : (matched ?? 'ERROR'),
      message: error.message,
    };
  }

  return { ok: true, transaction: data as unknown as WalletTransaction };
}

/** Solde courant, lu depuis le profil (miroir du grand livre). */
export async function getBalance(userId: string): Promise<number> {
  const admin = createAdminClient();
  const { data } = await admin.from('profiles').select('balance').eq('id', userId).maybeSingle();
  return Number(data?.balance ?? 0);
}

export async function listWalletTransactions(userId: string, limit = 50) {
  const admin = createAdminClient();
  const { data } = await admin
    .from('wallet_transactions')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(limit);

  return (data ?? []) as WalletTransaction[];
}
