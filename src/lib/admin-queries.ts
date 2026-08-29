import 'server-only';
import { createAdminClient } from '@/lib/supabase/admin';
import type { Order, OrderEvent, OrderItem, OrderStatus, Profile, Service } from '@/lib/supabase/types';

/**
 * Requêtes de l'espace d'administration.
 * Toujours appelées APRÈS `requireAdmin()` : elles utilisent la clé
 * service_role et contournent donc la RLS par construction.
 */

export type DateRange = 'today' | '7d' | '30d' | 'all';

export function rangeStart(range: DateRange): string | null {
  const now = new Date();
  switch (range) {
    case 'today': {
      const start = new Date(now);
      start.setHours(0, 0, 0, 0);
      return start.toISOString();
    }
    case '7d':
      return new Date(now.getTime() - 7 * 86_400_000).toISOString();
    case '30d':
      return new Date(now.getTime() - 30 * 86_400_000).toISOString();
    default:
      return null;
  }
}

export type AdminStats = {
  totalOrders: number;
  pending: number;
  processing: number;
  completed: number;
  canceled: number;
  failed: number;
  partial: number;
  revenue: number;
  completedRevenue: number;
  pendingRevenue: number;
  processingRevenue: number;
  customers: number;
  admins: number;
  services: number;
  walletTotal: number;
  walletHolders: number;
};

export async function getAdminStats(range: DateRange = 'all'): Promise<AdminStats> {
  const admin = createAdminClient();
  const from = rangeStart(range);

  let query = admin.from('orders').select('status, total');
  if (from) query = query.gte('created_at', from);

  const [{ data: orders }, { count: customers }, { count: admins }, { count: services }, { data: wallets }] =
    await Promise.all([
      query,
      admin.from('profiles').select('id', { count: 'exact', head: true }),
      admin.from('profiles').select('id', { count: 'exact', head: true }).neq('role', 'customer'),
      admin.from('services').select('id', { count: 'exact', head: true }).eq('is_active', true),
      admin.from('profiles').select('balance').gt('balance', 0),
    ]);

  const rows = (orders ?? []) as Array<{ status: string; total: number }>;
  const countBy = (...statuses: string[]) => rows.filter((r) => statuses.includes(r.status)).length;
  const sumBy = (...statuses: string[]) =>
    rows.filter((r) => statuses.includes(r.status)).reduce((sum, r) => sum + Number(r.total ?? 0), 0);

  return {
    totalOrders: rows.length,
    pending: countBy('pending'),
    processing: countBy('processing', 'in_progress'),
    completed: countBy('completed'),
    canceled: countBy('canceled', 'refunded'),
    failed: countBy('failed'),
    partial: countBy('partial'),
    revenue: rows.reduce((sum, r) => sum + Number(r.total ?? 0), 0),
    completedRevenue: sumBy('completed'),
    pendingRevenue: sumBy('pending'),
    processingRevenue: sumBy('processing', 'in_progress'),
    customers: customers ?? 0,
    admins: admins ?? 0,
    services: services ?? 0,
    walletTotal: (wallets ?? []).reduce((sum, w) => sum + Number(w.balance ?? 0), 0),
    walletHolders: (wallets ?? []).length,
  };
}

/** Volume quotidien sur la période, pour le graphique du dashboard. */
export async function getDailyVolume(range: DateRange = '30d') {
  const admin = createAdminClient();
  const from = rangeStart(range) ?? rangeStart('30d')!;

  const { data } = await admin
    .from('orders')
    .select('created_at, total')
    .gte('created_at', from)
    .order('created_at');

  const buckets = new Map<string, number>();
  for (const row of (data ?? []) as Array<{ created_at: string; total: number }>) {
    const day = row.created_at.slice(0, 10);
    buckets.set(day, (buckets.get(day) ?? 0) + Number(row.total ?? 0));
  }

  return [...buckets.entries()].map(([day, total]) => ({ day, total }));
}

export type OrderWithCustomer = Order & {
  items_count: number;
  first_service: string | null;
  quantity: number;
};

export type OrderFilters = {
  q?: string;
  status?: string;
  range?: DateRange;
  page?: number;
  perPage?: number;
  sort?: 'newest' | 'oldest' | 'amount-desc' | 'amount-asc';
};

export async function listOrders(filters: OrderFilters = {}) {
  const { q, status, range = 'all', page = 1, perPage = 20, sort = 'newest' } = filters;
  const admin = createAdminClient();

  let query = admin
    .from('orders')
    .select('*, order_items ( id, service_name, quantity )', { count: 'exact' });

  if (status && status !== 'all') query = query.eq('status', status as OrderStatus);

  const from = rangeStart(range);
  if (from) query = query.gte('created_at', from);

  if (q) {
    // Recherche sur l'e-mail, le nom, ou l'identifiant de commande.
    const escaped = q.replace(/[,()]/g, '');
    query = query.or(
      `email.ilike.%${escaped}%,first_name.ilike.%${escaped}%,last_name.ilike.%${escaped}%`
    );
  }

  if (sort === 'oldest') query = query.order('created_at', { ascending: true });
  else if (sort === 'amount-desc') query = query.order('total', { ascending: false });
  else if (sort === 'amount-asc') query = query.order('total', { ascending: true });
  else query = query.order('created_at', { ascending: false });

  const offset = (page - 1) * perPage;
  const { data, count, error } = await query.range(offset, offset + perPage - 1);

  if (error) {
    console.error('[listOrders]', error.message);
    return { orders: [] as OrderWithCustomer[], total: 0 };
  }

  const orders = (data ?? []).map((row) => {
    const items = ((row as { order_items?: Array<{ service_name: string; quantity: number }> }).order_items) ?? [];
    return {
      ...(row as Order),
      items_count: items.length,
      first_service: items[0]?.service_name ?? null,
      quantity: items.reduce((sum, i) => sum + Number(i.quantity ?? 0), 0),
    } as OrderWithCustomer;
  });

  return { orders, total: count ?? 0 };
}

export async function getOrderDetail(id: string) {
  const admin = createAdminClient();

  const { data: order } = await admin.from('orders').select('*').eq('id', id).maybeSingle();
  if (!order) return null;

  const [{ data: items }, { data: events }, { data: profile }] = await Promise.all([
    admin.from('order_items').select('*').eq('order_id', id).order('created_at'),
    admin.from('order_events').select('*').eq('order_id', id).order('created_at', { ascending: false }),
    (order as Order).user_id
      ? admin.from('profiles').select('*').eq('id', (order as Order).user_id as string).maybeSingle()
      : Promise.resolve({ data: null }),
  ]);

  // Catégorie et plateforme viennent du catalogue, pas de la ligne de commande.
  const serviceIds = [...new Set(((items ?? []) as OrderItem[]).map((i) => i.service_id).filter(Boolean))];
  const { data: services } = serviceIds.length
    ? await admin.from('services').select('*').in('id', serviceIds as string[])
    : { data: [] };

  return {
    order: order as Order,
    items: (items ?? []) as OrderItem[],
    events: (events ?? []) as OrderEvent[],
    profile: (profile as Profile) ?? null,
    services: (services ?? []) as Service[],
  };
}

export async function listCustomers({
  q,
  role,
  page = 1,
  perPage = 20,
}: {
  q?: string;
  role?: string;
  page?: number;
  perPage?: number;
}) {
  const admin = createAdminClient();

  let query = admin.from('profiles').select('*', { count: 'exact' });
  if (q) {
    const escaped = q.replace(/[,()]/g, '');
    query = query.or(`username.ilike.%${escaped}%,full_name.ilike.%${escaped}%`);
  }
  if (role && role !== 'all') query = query.eq('role', role as 'customer' | 'admin' | 'support');

  const offset = (page - 1) * perPage;
  const { data, count } = await query
    .order('created_at', { ascending: false })
    .range(offset, offset + perPage - 1);

  const profiles = (data ?? []) as Profile[];

  // Nombre de commandes et volume par client.
  const ids = profiles.map((p) => p.id);
  const { data: orders } = ids.length
    ? await admin.from('orders').select('user_id, total').in('user_id', ids)
    : { data: [] };

  const stats = new Map<string, { orders: number; spent: number }>();
  for (const row of (orders ?? []) as Array<{ user_id: string; total: number }>) {
    const entry = stats.get(row.user_id) ?? { orders: 0, spent: 0 };
    entry.orders += 1;
    entry.spent += Number(row.total ?? 0);
    stats.set(row.user_id, entry);
  }

  return {
    customers: profiles.map((p) => ({ ...p, ...(stats.get(p.id) ?? { orders: 0, spent: 0 }) })),
    total: count ?? 0,
  };
}

export async function listAdminServices({
  q,
  platform,
  status,
  page = 1,
  perPage = 25,
}: {
  q?: string;
  platform?: string;
  status?: string;
  page?: number;
  perPage?: number;
}) {
  const admin = createAdminClient();

  let query = admin.from('services').select('*', { count: 'exact' });

  /*
    Recherche : nom affiché, libellé fournisseur, et identifiant SMMGen.

    L'identifiant est ce que l'on a sous les yeux dans le panel du
    fournisseur ou dans un échange avec son support ; le chercher par nom
    est impossible quand le service a été renommé chez nous. On l'inclut
    donc, mais seulement si la saisie est entièrement numérique — sinon
    PostgREST rejetterait la comparaison `bigint = 'abc'` et la recherche
    échouerait pour tout le monde.

    `provider_name` couvre le cas inverse : retrouver un service par son
    libellé d'origine après l'avoir renommé.

    Les virgules et parenthèses sont retirées : `or()` les utilise comme
    séparateurs, une saisie qui en contient casserait le filtre.
  */
  if (q) {
    const term = q.trim().replace(/[,()]/g, ' ');

    if (term) {
      const filters = [`name.ilike.%${term}%`, `provider_name.ilike.%${term}%`];
      if (/^\d+$/.test(term)) filters.push(`provider_service_id.eq.${term}`);
      query = query.or(filters.join(','));
    }
  }
  if (platform && platform !== 'all') query = query.eq('platform', platform);
  if (status === 'active') query = query.eq('is_active', true);
  if (status === 'inactive') query = query.eq('is_active', false);

  const offset = (page - 1) * perPage;
  const { data, count } = await query
    .order('provider_service_id')
    .range(offset, offset + perPage - 1);

  return { services: (data ?? []) as Service[], total: count ?? 0 };
}

export async function getRecentOrders(limit = 8) {
  const admin = createAdminClient();
  const { data } = await admin
    .from('orders')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(limit);

  return (data ?? []) as Order[];
}
