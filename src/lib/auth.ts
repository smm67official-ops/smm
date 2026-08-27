import 'server-only';
import { createClient } from '@/lib/supabase/server';
import { hasSupabaseEnv } from '@/lib/queries';
import type { Profile, UserRole } from '@/lib/supabase/types';

export type SessionUser = {
  id: string;
  email: string;
  profile: Profile | null;
  role: UserRole;
  /** Compte suspendu : lu ici pour que chaque page puisse s'y fier. */
  blocked: boolean;
};

/** Utilisateur courant + profil, ou null si pas de session. */
export async function getSessionUser(): Promise<SessionUser | null> {
  if (!hasSupabaseEnv()) return null;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return null;

  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .maybeSingle();

  const row = (profile as Profile | null) ?? null;

  return {
    id: user.id,
    email: user.email ?? '',
    profile: row,
    role: (row?.role ?? 'customer') as UserRole,
    // `?? false` : sur une base où la migration 009 n'est pas passée, la
    // colonne est absente — un compte n'est alors jamais considéré bloqué,
    // ce qui préserve le comportement existant.
    blocked: Boolean(row?.is_blocked ?? false),
  };
}

/**
 * Session utilisable : présente ET non suspendue.
 *
 * Les pages client passent par ici plutôt que par `getSessionUser`, pour
 * qu'un compte bloqué ne puisse pas continuer à naviguer avec une
 * session déjà ouverte. La base reste la couche décisive : les
 * politiques d'insertion portent `not is_blocked()`.
 */
export async function requireActiveUser(): Promise<
  { ok: true; user: SessionUser } | { ok: false; reason: 'anonymous' | 'blocked' }
> {
  const user = await getSessionUser();
  if (!user) return { ok: false, reason: 'anonymous' };
  if (user.blocked) return { ok: false, reason: 'blocked' };
  return { ok: true, user };
}

export const isAdminRole = (role?: UserRole | null) => role === 'admin' || role === 'support';

/**
 * Vérification d'autorisation côté serveur.
 * La RLS reste la dernière ligne de défense : ce contrôle sert à renvoyer
 * une 401/403 propre et à éviter d'afficher une page vide.
 */
export async function requireAdmin(): Promise<
  { ok: true; user: SessionUser } | { ok: false; status: 401 | 403 }
> {
  const user = await getSessionUser();
  if (!user) return { ok: false, status: 401 };
  // Un administrateur suspendu perd ses pouvoirs : sans cela, bloquer un
  // compte compromis ne l'empêcherait pas d'agir sur le back-office.
  if (user.blocked) return { ok: false, status: 403 };
  if (!isAdminRole(user.role)) return { ok: false, status: 403 };
  return { ok: true, user };
}
