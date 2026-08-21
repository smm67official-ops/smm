-- =============================================================
--  Migration 002 — rôle admin, wishlist, cycle de vie des commandes
--  Additive et rétro-compatible : aucune table n'est supprimée,
--  aucune donnée existante n'est perdue.
--  À exécuter dans Supabase Studio > SQL Editor après schema.sql.
-- =============================================================

-- -------------------------------------------------------------
-- 1. Rôle sur les profils
-- -------------------------------------------------------------
alter table public.profiles
  add column if not exists role text not null default 'customer';

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'profiles_role_check'
  ) then
    alter table public.profiles
      add constraint profiles_role_check check (role in ('customer', 'admin', 'support'));
  end if;
end $$;

create index if not exists profiles_role_idx on public.profiles (role);

/**
 * `security definer` : la fonction lit profiles en contournant la RLS,
 * ce qui évite une récursion infinie dans les policies qui l'utilisent.
 */
create or replace function public.is_admin()
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role in ('admin', 'support')
  );
$$;

revoke all on function public.is_admin() from public;
grant execute on function public.is_admin() to authenticated, anon;

-- -------------------------------------------------------------
-- 2. Wishlist persistante
-- -------------------------------------------------------------
create table if not exists public.wishlists (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users (id) on delete cascade,
  service_id uuid not null references public.services (id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (user_id, service_id)
);

create index if not exists wishlists_user_idx on public.wishlists (user_id, created_at desc);

-- -------------------------------------------------------------
-- 3. Cycle de vie des commandes
-- -------------------------------------------------------------
alter table public.orders
  add column if not exists updated_at        timestamptz not null default now(),
  add column if not exists idempotency_key   text,
  add column if not exists provider_error    text,
  add column if not exists submitted_at      timestamptz;

-- Empêche la création d'une commande en double lors d'un rejeu de requête.
create unique index if not exists orders_idempotency_idx
  on public.orders (idempotency_key)
  where idempotency_key is not null;

-- `failed` manquait dans la contrainte d'origine.
alter table public.orders drop constraint if exists orders_status_check;
alter table public.orders
  add constraint orders_status_check check (
    status in ('pending', 'processing', 'in_progress', 'completed',
               'partial', 'canceled', 'failed', 'refunded')
  );

alter table public.order_items
  add column if not exists updated_at     timestamptz not null default now(),
  add column if not exists provider_error text,
  add column if not exists synced_at      timestamptz;

create index if not exists order_items_provider_idx
  on public.order_items (provider_order_id)
  where provider_order_id is not null;

create index if not exists orders_status_idx  on public.orders (status, created_at desc);
create index if not exists orders_created_idx on public.orders (created_at desc);

-- Horodatage automatique de la dernière modification
create or replace function public.touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists orders_touch_updated_at on public.orders;
create trigger orders_touch_updated_at
  before update on public.orders
  for each row execute function public.touch_updated_at();

drop trigger if exists order_items_touch_updated_at on public.order_items;
create trigger order_items_touch_updated_at
  before update on public.order_items
  for each row execute function public.touch_updated_at();

-- -------------------------------------------------------------
-- 4. Journal des changements de statut (traçabilité)
-- -------------------------------------------------------------
create table if not exists public.order_events (
  id          uuid primary key default gen_random_uuid(),
  order_id    uuid not null references public.orders (id) on delete cascade,
  from_status text,
  to_status   text not null,
  source      text not null default 'system',  -- system | admin | provider
  actor_id    uuid references auth.users (id) on delete set null,
  note        text,
  created_at  timestamptz not null default now()
);

create index if not exists order_events_order_idx on public.order_events (order_id, created_at desc);

-- -------------------------------------------------------------
-- 5. Statistiques admin (agrégats, jamais de données nominatives)
-- -------------------------------------------------------------
create or replace view public.admin_order_stats as
select
  count(*)                                                    as total_orders,
  count(*) filter (where status = 'pending')                  as pending_orders,
  count(*) filter (where status in ('processing', 'in_progress')) as processing_orders,
  count(*) filter (where status = 'completed')                as completed_orders,
  count(*) filter (where status = 'canceled')                 as canceled_orders,
  count(*) filter (where status = 'failed')                   as failed_orders,
  count(*) filter (where status = 'partial')                  as partial_orders,
  coalesce(sum(total), 0)                                     as total_revenue,
  coalesce(sum(total) filter (where status = 'completed'), 0) as completed_revenue
from public.orders;

-- Une vue ne porte pas de RLS : l'accès est retiré aux rôles publics.
-- Seul le service_role (routes serveur protégées) peut la lire.
revoke all on public.admin_order_stats from anon, authenticated;

-- =============================================================
--  Row Level Security
-- =============================================================
alter table public.wishlists    enable row level security;
alter table public.order_events enable row level security;

-- ---------- Wishlist : strictement personnelle ----------
drop policy if exists "own wishlist read" on public.wishlists;
create policy "own wishlist read" on public.wishlists
  for select using (auth.uid() = user_id or public.is_admin());

drop policy if exists "own wishlist insert" on public.wishlists;
create policy "own wishlist insert" on public.wishlists
  for insert with check (auth.uid() = user_id);

drop policy if exists "own wishlist delete" on public.wishlists;
create policy "own wishlist delete" on public.wishlists
  for delete using (auth.uid() = user_id);

-- ---------- Profils : l'admin voit tout, le client son profil ----------
drop policy if exists "own profile read" on public.profiles;
create policy "own profile read" on public.profiles
  for select using (auth.uid() = id or public.is_admin());

drop policy if exists "own profile update" on public.profiles;
create policy "own profile update" on public.profiles
  for update using (auth.uid() = id) with check (auth.uid() = id);

-- Le rôle ne doit jamais être modifiable par le client : la colonne est
-- protégée par un trigger, la policy update seule ne suffirait pas.
create or replace function public.protect_profile_role()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- `auth.uid() is null` = contexte service_role ou éditeur SQL, déjà de
  -- confiance. Un client authentifié ne peut jamais s'auto-promouvoir.
  if new.role is distinct from old.role
     and auth.uid() is not null
     and not public.is_admin() then
    raise exception 'role can only be changed by an administrator';
  end if;
  return new;
end;
$$;

drop trigger if exists profiles_protect_role on public.profiles;
create trigger profiles_protect_role
  before update on public.profiles
  for each row execute function public.protect_profile_role();

-- ---------- Commandes : client = les siennes, admin = toutes ----------
drop policy if exists "own orders read" on public.orders;
create policy "own orders read" on public.orders
  for select using (auth.uid() = user_id or public.is_admin());

drop policy if exists "own orders insert" on public.orders;
create policy "own orders insert" on public.orders
  for insert with check (auth.uid() = user_id);

drop policy if exists "admin orders update" on public.orders;
create policy "admin orders update" on public.orders
  for update using (public.is_admin()) with check (public.is_admin());

drop policy if exists "own order items read" on public.order_items;
create policy "own order items read" on public.order_items
  for select using (
    public.is_admin()
    or exists (
      select 1 from public.orders o
      where o.id = order_items.order_id and o.user_id = auth.uid()
    )
  );

drop policy if exists "own order items insert" on public.order_items;
create policy "own order items insert" on public.order_items
  for insert with check (
    exists (
      select 1 from public.orders o
      where o.id = order_items.order_id and o.user_id = auth.uid()
    )
  );

drop policy if exists "admin order items update" on public.order_items;
create policy "admin order items update" on public.order_items
  for update using (public.is_admin()) with check (public.is_admin());

-- ---------- Journal : lecture par le propriétaire et l'admin ----------
drop policy if exists "order events read" on public.order_events;
create policy "order events read" on public.order_events
  for select using (
    public.is_admin()
    or exists (
      select 1 from public.orders o
      where o.id = order_events.order_id and o.user_id = auth.uid()
    )
  );

-- ---------- Catalogue : écriture réservée à l'admin ----------
drop policy if exists "admin services write" on public.services;
create policy "admin services write" on public.services
  for update using (public.is_admin()) with check (public.is_admin());

-- ---------- Contact & newsletter : lecture admin ----------
drop policy if exists "admin contact read" on public.contact_messages;
create policy "admin contact read" on public.contact_messages
  for select using (public.is_admin());

drop policy if exists "admin newsletter read" on public.newsletter_subscribers;
create policy "admin newsletter read" on public.newsletter_subscribers
  for select using (public.is_admin());

-- =============================================================
--  Promotion d'un administrateur
--  Remplacez l'adresse puis exécutez cette requête une seule fois.
-- =============================================================
-- update public.profiles set role = 'admin'
-- where id = (select id from auth.users where email = 'contact@dashypay.com');
