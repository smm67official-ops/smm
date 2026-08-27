import 'server-only';
import { createAdminClient } from '@/lib/supabase/admin';
import { freshProviderBalance, providerBalanceStatus } from '@/lib/provider-balance';
import { audit } from '@/lib/audit';
import type { ProviderBalance } from '@/lib/provider-balance';
import type { WalletTransaction } from '@/lib/supabase/types';

/**
 * Allocation et reprise de solde client, adossées au solde fournisseur.
 *
 * L'invariant tenu est :
 *
 *     somme des soldes clients <= solde SMMGen
 *
 * Le contrôle et l'écriture vivent dans une fonction PostgreSQL, sous un
 * verrou d'avis : les vérifier ici puis écrire là-bas laisserait deux
 * administrateurs simultanés passer le même contrôle avant que l'un des
 * deux n'écrive.
 */

export type BalanceErrorCode =
  | 'MIGRATION_MISSING'
  | 'INVALID_AMOUNT'
  | 'INSUFFICIENT_PROVIDER_BALANCE'
  | 'INSUFFICIENT_CLIENT_BALANCE'
  | 'PROVIDER_UNAVAILABLE'
  | 'PROVIDER_SYNC_FAILED'
  | 'UNKNOWN_WALLET'
  | 'TRANSACTION_FAILED';

export type BalanceResult =
  | { ok: true; transaction: WalletTransaction; balance: number; available: number }
  | { ok: false; code: BalanceErrorCode; message: string };

/** Messages destinés à l'interface — jamais de trace technique. */
export const BALANCE_MESSAGE: Record<BalanceErrorCode, string> = {
  MIGRATION_MISSING: 'Balance control needs migration 009 — run it in the Supabase SQL editor.',
  INVALID_AMOUNT: 'Amount must be greater than zero.',
  INSUFFICIENT_PROVIDER_BALANCE: 'Insufficient SMMGen balance for this allocation.',
  INSUFFICIENT_CLIENT_BALANCE: 'Insufficient client balance.',
  PROVIDER_UNAVAILABLE: 'SMMGen is not configured.',
  PROVIDER_SYNC_FAILED: 'Could not read the SMMGen balance — no balance was changed.',
  UNKNOWN_WALLET: 'Unknown customer.',
  TRANSACTION_FAILED: 'The operation failed and nothing was changed.',
};

const CODES: BalanceErrorCode[] = [
  'INSUFFICIENT_PROVIDER_BALANCE',
  'INSUFFICIENT_CLIENT_BALANCE',
  'INVALID_AMOUNT',
  'UNKNOWN_WALLET',
];

/**
 * Traduit l'erreur PostgreSQL en code métier.
 *
 * Une fonction absente (migration 009 non appliquée) ne doit pas
 * ressembler à un refus métier : « l'opération a échoué » enverrait
 * chercher un problème de solde là où il faut exécuter un script.
 */
function classify(message: string): BalanceErrorCode {
  if (/Could not find the function|does not exist|schema cache/i.test(message)) {
    return 'MIGRATION_MISSING';
  }
  return CODES.find((c) => message.includes(c)) ?? 'TRANSACTION_FAILED';
}

/** Deux décimales : au-delà, l'affiché et le crédité divergent. */
export function normalizeAmount(input: unknown): number | null {
  const amount = Number(input);
  if (!Number.isFinite(amount) || amount <= 0) return null;
  return Math.round(amount * 100) / 100;
}

export async function totalAllocated(): Promise<number> {
  const admin = createAdminClient();
  const { data } = await admin.rpc('total_allocated_balance');
  return Number(data ?? 0);
}

/**
 * Alloue du solde à un client.
 *
 * Le solde fournisseur est relu à l'instant, jamais pris au cache : une
 * allocation décidée sur un chiffre périmé n'est pas un contrôle.
 */
export async function allocateBalance(input: {
  userId: string;
  amount: number;
  actorId: string;
  reason?: string | null;
  reference?: string | null;
  ip?: string | null;
}): Promise<BalanceResult> {
  const amount = normalizeAmount(input.amount);
  if (amount === null) {
    return { ok: false, code: 'INVALID_AMOUNT', message: BALANCE_MESSAGE.INVALID_AMOUNT };
  }

  const provider = await freshProviderBalance(input.actorId);
  if (!provider.ok) {
    await audit({
      action: 'SMMGEN_SYNC_FAILED',
      actorId: input.actorId,
      targetId: input.userId,
      targetType: 'profile',
      amount,
      metadata: { stage: 'allocate', code: provider.code },
      ip: input.ip,
    });
    return { ok: false, code: provider.code, message: BALANCE_MESSAGE[provider.code] };
  }

  const admin = createAdminClient();
  const { data, error } = await admin.rpc('allocate_balance', {
    p_user_id: input.userId,
    p_amount: amount,
    p_provider_balance: provider.balance,
    p_actor_id: input.actorId,
    p_reason: input.reason ?? null,
    p_reference: input.reference ?? null,
    p_metadata: { provider_currency: provider.currency, checked_at: provider.checkedAt },
  });

  if (error) {
    const code = classify(error.message);
    return { ok: false, code, message: BALANCE_MESSAGE[code] };
  }

  const transaction = data as unknown as WalletTransaction;

  await audit({
    action: 'BALANCE_ALLOCATED',
    actorId: input.actorId,
    targetId: input.userId,
    targetType: 'profile',
    amount,
    metadata: {
      transaction_id: transaction.id,
      balance_before: transaction.balance_before,
      balance_after: transaction.balance_after,
      provider_balance: provider.balance,
      available_after: transaction.provider_balance_after,
    },
    ip: input.ip,
  });

  return {
    ok: true,
    transaction,
    balance: Number(transaction.balance_after),
    available: Number(transaction.provider_balance_after ?? 0),
  };
}

/**
 * Reprend du solde à un client.
 *
 * Ne consomme rien chez le fournisseur : cela libère au contraire du
 * disponible. Le solde fournisseur est lu pour l'historique, et son
 * indisponibilité n'empêche pas l'opération — refuser de reprendre du
 * solde parce qu'une API tierce répond mal serait absurde.
 */
export async function reclaimBalance(input: {
  userId: string;
  amount: number;
  actorId: string;
  reason?: string | null;
  reference?: string | null;
  ip?: string | null;
}): Promise<BalanceResult> {
  const amount = normalizeAmount(input.amount);
  if (amount === null) {
    return { ok: false, code: 'INVALID_AMOUNT', message: BALANCE_MESSAGE.INVALID_AMOUNT };
  }

  const provider = await freshProviderBalance(input.actorId);
  const providerBalance = provider.ok ? provider.balance : null;

  const admin = createAdminClient();
  const { data, error } = await admin.rpc('reclaim_balance', {
    p_user_id: input.userId,
    p_amount: amount,
    p_provider_balance: providerBalance,
    p_actor_id: input.actorId,
    p_reason: input.reason ?? null,
    p_reference: input.reference ?? null,
    p_metadata: { provider_read: provider.ok ? 'live' : 'unavailable' },
  });

  if (error) {
    const code = classify(error.message);
    return { ok: false, code, message: BALANCE_MESSAGE[code] };
  }

  const transaction = data as unknown as WalletTransaction;

  await audit({
    action: 'BALANCE_RECLAIMED',
    actorId: input.actorId,
    targetId: input.userId,
    targetType: 'profile',
    amount,
    metadata: {
      transaction_id: transaction.id,
      balance_before: transaction.balance_before,
      balance_after: transaction.balance_after,
      provider_balance: providerBalance,
    },
    ip: input.ip,
  });

  return {
    ok: true,
    transaction,
    balance: Number(transaction.balance_after),
    available: Number(transaction.provider_balance_after ?? 0),
  };
}

// -------------------------------------------------------------------
//  Vérification de cohérence
// -------------------------------------------------------------------

export type ConsistencyIssue = {
  code: string;
  severity: 'warning' | 'critical';
  detail: string;
};

export type BalanceReport = {
  provider: ProviderBalance;
  allocated: number;
  clientTotal: number;
  ledgerTotal: number;
  available: number | null;
  difference: number | null;
  consistent: boolean;
  issues: ConsistencyIssue[];
  checkedAt: string;
};

/**
 * Tolérance de comparaison.
 *
 * Les montants sont en `numeric(18,5)` : deux chemins de calcul peuvent
 * différer d'un dernier chiffre sans que rien ne soit anormal. Un demi
 * centime sépare l'arrondi de l'anomalie réelle.
 */
const EPSILON = 0.005;

/**
 * Compare le fournisseur, les soldes clients et le grand livre.
 *
 * Ne corrige rien, volontairement : une correction automatique
 * effacerait la trace de l'incident et rendrait l'enquête impossible.
 * On rapporte, on chiffre, on laisse décider.
 */
export async function verifyBalances(actorId?: string | null): Promise<BalanceReport> {
  const admin = createAdminClient();
  const issues: ConsistencyIssue[] = [];

  const provider = await providerBalanceStatus();

  const { data: profiles } = await admin
    .from('profiles')
    .select('id, username, balance')
    .order('balance', { ascending: false });

  const rows = (profiles ?? []) as Array<{ id: string; username: string | null; balance: number }>;
  const clientTotal = rows.reduce((sum, r) => sum + Number(r.balance ?? 0), 0);

  // Un solde négatif est impossible par contrainte ; s'il apparaît,
  // c'est que la contrainte a été contournée.
  const negatives = rows.filter((r) => Number(r.balance) < 0);
  if (negatives.length > 0) {
    issues.push({
      code: 'NEGATIVE_BALANCE',
      severity: 'critical',
      detail: `${negatives.length} account(s) hold a negative balance: ${negatives
        .map((n) => n.username ?? n.id.slice(0, 8))
        .join(', ')}`,
    });
  }

  /*
    Le grand livre doit reconstituer les soldes.

    `profiles.balance` est la valeur qui fait foi ; la somme des
    mouvements en est l'histoire. Un écart signale une écriture directe
    en base, un mouvement perdu, ou un doublon.
  */
  const { data: ledger } = await admin.from('wallet_transactions').select('amount, status');
  const ledgerRows = (ledger ?? []) as Array<{ amount: number; status?: string }>;
  const ledgerTotal = ledgerRows
    .filter((t) => (t.status ?? 'SUCCESS') === 'SUCCESS')
    .reduce((sum, t) => sum + Number(t.amount ?? 0), 0);

  if (Math.abs(ledgerTotal - clientTotal) > EPSILON) {
    issues.push({
      code: 'LEDGER_MISMATCH',
      severity: 'critical',
      detail:
        `Ledger sums to ${ledgerTotal.toFixed(2)} but client balances total ` +
        `${clientTotal.toFixed(2)} (gap ${(clientTotal - ledgerTotal).toFixed(2)}). ` +
        'A balance was likely written directly in the database, or a movement is missing.',
    });
  }

  // Doublons : même client, même montant, même type, à la même seconde.
  const { data: recent } = await admin
    .from('wallet_transactions')
    .select('user_id, amount, type, created_at')
    .order('created_at', { ascending: false })
    .limit(500);

  const seen = new Map<string, number>();
  for (const t of (recent ?? []) as Array<{
    user_id: string;
    amount: number;
    type: string;
    created_at: string;
  }>) {
    const key = `${t.user_id}|${t.amount}|${t.type}|${t.created_at.slice(0, 19)}`;
    seen.set(key, (seen.get(key) ?? 0) + 1);
  }
  const duplicates = [...seen.values()].filter((n) => n > 1).length;
  if (duplicates > 0) {
    issues.push({
      code: 'DUPLICATE_TRANSACTIONS',
      severity: 'warning',
      detail: `${duplicates} group(s) of identical movements share the same second — possible double submission.`,
    });
  }

  let available: number | null = null;
  let difference: number | null = null;

  if (provider.balance === null) {
    issues.push({
      code: 'PROVIDER_UNREACHABLE',
      severity: 'warning',
      detail:
        provider.error ??
        'The SMMGen balance could not be read, so allocation cannot be verified against it.',
    });
  } else {
    available = provider.balance - clientTotal;
    difference = available;

    if (available < -EPSILON) {
      issues.push({
        code: 'OVER_ALLOCATED',
        severity: 'critical',
        detail:
          `Client balances total ${clientTotal.toFixed(2)} against an SMMGen balance of ` +
          `${provider.balance.toFixed(2)} — over-allocated by ${Math.abs(available).toFixed(2)}. ` +
          'Orders may fail at the provider.',
      });
    }

    if (provider.status !== 'LIVE') {
      issues.push({
        code: 'PROVIDER_STALE',
        severity: 'warning',
        detail:
          provider.status === 'STALE'
            ? `Figure dates from ${provider.checkedAt} and could not be refreshed.`
            : (provider.error ?? 'Last synchronisation failed.'),
      });
    }
  }

  const report: BalanceReport = {
    provider,
    allocated: clientTotal,
    clientTotal,
    ledgerTotal,
    available,
    difference,
    consistent: issues.filter((i) => i.severity === 'critical').length === 0,
    issues,
    checkedAt: new Date().toISOString(),
  };

  await audit({
    action: 'BALANCE_VERIFIED',
    actorId,
    metadata: {
      consistent: report.consistent,
      issues: issues.map((i) => i.code),
      client_total: clientTotal,
      provider_balance: provider.balance,
    },
  });

  return report;
}
