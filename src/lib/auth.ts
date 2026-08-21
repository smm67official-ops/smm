import 'server-only';
import { createClient } from '@/lib/supabase/server';
import { hasSupabaseEnv } from '@/lib/queries';
import type { Profile, UserRole } from '@/lib/supabase/types';

export type SessionUser = {
  id: string;
  email: string;
  profile: Profile | null;
  role: UserRole;
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

  return {
    id: user.id,
    email: user.email ?? '',
    profile: (profile as Profile) ?? null,
    role: ((profile as Profile | null)?.role ?? 'customer') as UserRole,
  };
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
  if (!isAdminRole(user.role)) return { ok: false, status: 403 };
  return { ok: true, user };
}
