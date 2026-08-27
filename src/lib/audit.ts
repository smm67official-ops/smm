import 'server-only';
import { createAdminClient } from '@/lib/supabase/admin';
import type { AuditLog } from '@/lib/supabase/types';

/**
 * Journal des actions sensibles.
 *
 * Écrit uniquement par la clé de service : aucune politique d'écriture
 * n'existe sur la table, il est donc inaltérable depuis un navigateur.
 */

export type AuditAction =
  | 'LOGIN'
  | 'GOOGLE_LOGIN'
  | 'USER_BLOCKED'
  | 'USER_UNBLOCKED'
  | 'BALANCE_ALLOCATED'
  | 'BALANCE_RECLAIMED'
  | 'BALANCE_ADJUSTED'
  | 'BALANCE_VERIFIED'
  | 'SMMGEN_SYNC'
  | 'SMMGEN_SYNC_FAILED';

/**
 * Champs bannis du contexte.
 *
 * Un secret recopié dans un journal consultable par toute
 * l'administration, et jamais purgé, est un secret perdu. Le filtre est
 * appliqué à l'écriture plutôt que confié à la vigilance des appelants.
 */
const FORBIDDEN = /^(password|token|access_token|refresh_token|secret|api_?key|authorization|cookie)$/i;

function scrub(metadata: Record<string, unknown>): Record<string, unknown> {
  const clean: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(metadata ?? {})) {
    if (FORBIDDEN.test(key)) {
      clean[key] = '[redacted]';
      continue;
    }
    clean[key] = value && typeof value === 'object' && !Array.isArray(value)
      ? scrub(value as Record<string, unknown>)
      : value;
  }

  return clean;
}

/**
 * Consigne une action. Ne lève jamais.
 *
 * Le journal accompagne l'opération, il ne la commande pas : une
 * écriture de journal en échec ne doit pas annuler une allocation déjà
 * validée, ni faire échouer une connexion.
 */
export async function audit(entry: {
  action: AuditAction;
  actorId?: string | null;
  targetId?: string | null;
  targetType?: string | null;
  amount?: number | null;
  metadata?: Record<string, unknown>;
  ip?: string | null;
}): Promise<void> {
  try {
    await createAdminClient()
      .from('audit_logs')
      .insert({
        action: entry.action,
        actor_id: entry.actorId ?? null,
        target_id: entry.targetId ?? null,
        target_type: entry.targetType ?? null,
        amount: entry.amount ?? null,
        metadata: scrub(entry.metadata ?? {}),
        ip: entry.ip ?? null,
      });
  } catch {
    // Table absente (migration 009) ou base indisponible : on continue.
  }
}

/** Adresse d'origine, quand le proxy la transmet. */
export function clientIp(request: Request): string | null {
  const forwarded = request.headers.get('x-forwarded-for');
  if (forwarded) return forwarded.split(',')[0]!.trim();
  return request.headers.get('x-real-ip');
}

export async function listAuditLogs(limit = 100, action?: string): Promise<AuditLog[]> {
  const admin = createAdminClient();

  let query = admin
    .from('audit_logs')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(limit);

  if (action) query = query.eq('action', action);

  const { data } = await query;
  return (data ?? []) as AuditLog[];
}
