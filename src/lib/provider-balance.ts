import 'server-only';
import { SmmGen, SmmGenError } from '@/lib/smmgen';
import { createAdminClient } from '@/lib/supabase/admin';
import type { ProviderBalanceSnapshot } from '@/lib/supabase/types';

/**
 * Solde du compte fournisseur.
 *
 * L'API SMMGen expose ce solde en LECTURE SEULE (`action=balance`). Rien
 * ne permet d'en retirer ni d'y reverser des fonds : il ne bouge que
 * lorsqu'une commande est réellement passée. Ce module ne prétend donc
 * pas le modifier — il le lit, l'horodate, et dit franchement si la
 * valeur affichée est de première main ou périmée.
 */

/**
 * Au-delà, un relevé n'est plus présenté comme temps réel.
 *
 * Une minute : assez pour éviter d'interroger le fournisseur à chaque
 * rendu, assez court pour qu'un administrateur ne décide pas sur une
 * valeur qui a pu changer entre-temps. Les allocations, elles, ne
 * consultent jamais le cache — voir `freshProviderBalance`.
 */
export const STALE_AFTER_MS = 60_000;

export type ProviderStatus = 'LIVE' | 'STALE' | 'ERROR';

export type ProviderBalance = {
  status: ProviderStatus;
  balance: number | null;
  currency: string;
  /** Date du relevé présenté, réussi ou non. */
  checkedAt: string | null;
  /** Dernier relevé RÉUSSI, même ancien : utile quand le dernier a échoué. */
  lastSuccessAt: string | null;
  error: string | null;
};

const CURRENCY_FALLBACK = 'USD';

/** Enregistre un relevé, succès comme échec. Ne lève jamais. */
async function snapshot(row: {
  balance: number | null;
  currency: string | null;
  status: 'LIVE' | 'ERROR';
  error?: string | null;
  allocated?: number | null;
  checkedBy?: string | null;
}): Promise<void> {
  try {
    await createAdminClient()
      .from('provider_balance_snapshots')
      .insert({
        provider: 'smmgen',
        balance: row.balance,
        currency: row.currency,
        status: row.status,
        error: row.error ?? null,
        allocated: row.allocated ?? null,
        checked_by: row.checkedBy ?? null,
      });
  } catch {
    // Une table absente (migration 009 non appliquée) ne doit pas faire
    // échouer la lecture du solde, qui fonctionnait déjà sans elle.
  }
}

/**
 * Interroge le fournisseur maintenant, sans repli sur le cache.
 *
 * C'est la seule lecture admise avant une allocation : engager du solde
 * sur un chiffre périmé revient à ne pas contrôler du tout.
 */
export async function freshProviderBalance(
  checkedBy?: string | null
): Promise<
  | { ok: true; balance: number; currency: string; checkedAt: string }
  | { ok: false; code: 'PROVIDER_UNAVAILABLE' | 'PROVIDER_SYNC_FAILED'; message: string }
> {
  if (!process.env.SMMGEN_API_KEY) {
    await snapshot({ balance: null, currency: null, status: 'ERROR', error: 'SMMGEN_API_KEY missing' });
    return { ok: false, code: 'PROVIDER_UNAVAILABLE', message: 'SMMGEN_API_KEY is not configured.' };
  }

  try {
    const result = await new SmmGen().balance();
    const balance = Number(result.balance);

    // Une réponse 200 peut tout de même être inexploitable : on refuse
    // plutôt que de convertir un NaN en zéro, ce qui bloquerait toute
    // allocation en prétendant que le fournisseur est à sec.
    if (!Number.isFinite(balance)) {
      await snapshot({
        balance: null,
        currency: result.currency ?? null,
        status: 'ERROR',
        error: `Unexpected balance payload: ${JSON.stringify(result).slice(0, 200)}`,
        checkedBy,
      });
      return { ok: false, code: 'PROVIDER_SYNC_FAILED', message: 'Unexpected provider response.' };
    }

    const currency = result.currency ?? CURRENCY_FALLBACK;
    await snapshot({ balance, currency, status: 'LIVE', checkedBy });

    return { ok: true, balance, currency, checkedAt: new Date().toISOString() };
  } catch (e) {
    const message = e instanceof SmmGenError ? e.message : String(e);
    await snapshot({ balance: null, currency: null, status: 'ERROR', error: message.slice(0, 400), checkedBy });
    return { ok: false, code: 'PROVIDER_SYNC_FAILED', message };
  }
}

/**
 * État à afficher : relevé récent si possible, sinon le dernier connu,
 * explicitement marqué périmé.
 */
export async function providerBalanceStatus(): Promise<ProviderBalance> {
  const admin = createAdminClient();

  const { data, error } = await admin
    .from('provider_balance_snapshots')
    .select('*')
    .eq('provider', 'smmgen')
    .order('created_at', { ascending: false })
    .limit(10);

  const rows = (data ?? []) as ProviderBalanceSnapshot[];
  const latest = rows[0] ?? null;
  const lastSuccess = rows.find((r) => r.status === 'LIVE' && r.balance !== null) ?? null;

  // Aucun historique (ou table absente) : on interroge le fournisseur.
  if (error || !latest) {
    const fresh = await freshProviderBalance();
    return fresh.ok
      ? {
          status: 'LIVE',
          balance: fresh.balance,
          currency: fresh.currency,
          checkedAt: fresh.checkedAt,
          lastSuccessAt: fresh.checkedAt,
          error: null,
        }
      : {
          status: 'ERROR',
          balance: null,
          currency: CURRENCY_FALLBACK,
          checkedAt: new Date().toISOString(),
          lastSuccessAt: null,
          error: fresh.message,
        };
  }

  const age = Date.now() - new Date(latest.created_at).getTime();

  if (latest.status === 'ERROR') {
    return {
      status: 'ERROR',
      balance: lastSuccess ? Number(lastSuccess.balance) : null,
      currency: lastSuccess?.currency ?? CURRENCY_FALLBACK,
      checkedAt: latest.created_at,
      lastSuccessAt: lastSuccess?.created_at ?? null,
      error: latest.error,
    };
  }

  if (age > STALE_AFTER_MS) {
    // Relevé trop ancien : on retente, et on n'annonce « LIVE » que si
    // la nouvelle lecture aboutit réellement.
    const fresh = await freshProviderBalance();
    if (fresh.ok) {
      return {
        status: 'LIVE',
        balance: fresh.balance,
        currency: fresh.currency,
        checkedAt: fresh.checkedAt,
        lastSuccessAt: fresh.checkedAt,
        error: null,
      };
    }

    return {
      status: 'STALE',
      balance: Number(latest.balance),
      currency: latest.currency ?? CURRENCY_FALLBACK,
      checkedAt: latest.created_at,
      lastSuccessAt: latest.created_at,
      error: fresh.message,
    };
  }

  return {
    status: 'LIVE',
    balance: Number(latest.balance),
    currency: latest.currency ?? CURRENCY_FALLBACK,
    checkedAt: latest.created_at,
    lastSuccessAt: latest.created_at,
    error: null,
  };
}
