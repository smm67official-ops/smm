import 'server-only';
import { createClient } from '@/lib/supabase/server';
import type { PanelStats, Service, ServiceCategory } from '@/lib/supabase/types';

/**
 * Tant que `.env.local` n'est pas renseigné, les pages doivent rester
 * affichables (catalogue vide) plutôt que de renvoyer une 500.
 */
export const hasSupabaseEnv = () =>
  Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);

const SERVICE_COLUMNS =
  'id, provider, provider_service_id, name, type, category_name, category_id, platform, provider_rate, rate, min, max, refill, cancel, description, is_active, synced_at, created_at';

export type ServiceFilters = {
  q?: string;
  platform?: string;
  category?: string; // id de catégorie
  sort?: 'default' | 'price-asc' | 'price-desc';
  page?: number;
  perPage?: number;
};

export async function getServices(filters: ServiceFilters = {}) {
  const { q, platform, category, sort = 'default', page = 1, perPage = 25 } = filters;

  if (!hasSupabaseEnv()) return { services: [] as Service[], total: 0 };

  const supabase = await createClient();
  let query = supabase
    .from('services')
    .select(SERVICE_COLUMNS, { count: 'exact' })
    .eq('is_active', true);

  if (q) query = query.ilike('name', `%${q}%`);
  if (platform) query = query.eq('platform', platform);
  if (category) query = query.eq('category_id', category);

  if (sort === 'price-asc') query = query.order('rate', { ascending: true });
  else if (sort === 'price-desc') query = query.order('rate', { ascending: false });
  else query = query.order('provider_service_id', { ascending: true });

  const from = (page - 1) * perPage;
  const { data, count, error } = await query.range(from, from + perPage - 1);

  if (error) {
    console.error('[getServices]', error.message);
    return { services: [] as Service[], total: 0 };
  }

  return { services: (data ?? []) as Service[], total: count ?? 0 };
}

export async function getServiceById(id: string) {
  if (!hasSupabaseEnv()) return null;
  const supabase = await createClient();
  const { data } = await supabase
    .from('services')
    .select(SERVICE_COLUMNS)
    .eq('id', id)
    .maybeSingle();

  return (data as Service) ?? null;
}

export async function getRelatedServices(categoryId: string | null, excludeId: string, limit = 6) {
  if (!hasSupabaseEnv() || !categoryId) return [] as Service[];
  const supabase = await createClient();
  const { data } = await supabase
    .from('services')
    .select(SERVICE_COLUMNS)
    .eq('category_id', categoryId)
    .eq('is_active', true)
    .neq('id', excludeId)
    .limit(limit);

  return (data ?? []) as Service[];
}

export async function getServiceCategories(platform?: string) {
  if (!hasSupabaseEnv()) return [] as ServiceCategory[];
  const supabase = await createClient();
  let query = supabase
    .from('service_categories')
    .select('id, name, slug, platform, position, created_at')
    .order('position');

  if (platform) query = query.eq('platform', platform);

  const { data, error } = await query;
  if (error) console.error('[getServiceCategories]', error.message);
  return (data ?? []) as ServiceCategory[];
}

/** Plateformes réellement présentes dans le catalogue. */
export async function getActivePlatforms() {
  if (!hasSupabaseEnv()) return [] as string[];
  const supabase = await createClient();
  const { data } = await supabase
    .from('service_categories')
    .select('platform')
    .not('platform', 'is', null);

  return [...new Set((data ?? []).map((row) => row.platform as string))];
}

/** Compteurs affichés dans la section « statistiques en direct ». */
export async function getPanelStats(): Promise<PanelStats> {
  const empty: PanelStats = { users_count: 0, services_count: 0, orders_count: 0 };
  if (!hasSupabaseEnv()) return empty;

  const supabase = await createClient();
  const { data, error } = await supabase.from('panel_stats').select('*').maybeSingle();

  if (error) {
    console.error('[getPanelStats]', error.message);
    return empty;
  }

  return (data as PanelStats) ?? empty;
}

/**
 * Chiffres annoncés dans le bandeau d'accueil.
 *
 * Lus dans le catalogue plutôt qu'écrits en dur : une promesse
 * commerciale (« X services à partir de Y ») doit correspondre à ce que
 * le visiteur trouvera réellement dans la boutique.
 */
export async function getCatalogueHighlights(): Promise<{
  serviceCount: number;
  lowestRate: number;
}> {
  const fallback = { serviceCount: 0, lowestRate: 0 };
  if (!hasSupabaseEnv()) return fallback;

  const supabase = await createClient();

  const [{ count }, { data }] = await Promise.all([
    supabase.from('services').select('id', { count: 'exact', head: true }).eq('is_active', true),
    supabase
      .from('services')
      .select('rate')
      .eq('is_active', true)
      .order('rate', { ascending: true })
      .limit(1)
      .maybeSingle(),
  ]);

  return {
    serviceCount: count ?? 0,
    lowestRate: Number(data?.rate ?? 0),
  };
}
