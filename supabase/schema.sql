-- =============================================================
--  Panel SMM — schéma Supabase
--  À exécuter dans Supabase Studio > SQL Editor (une seule fois).
-- =============================================================

create extension if not exists "pgcrypto";

-- -------------------------------------------------------------
-- 1. Profils (miroir de auth.users)
-- -------------------------------------------------------------
create table if not exists public.profiles (
  id          uuid primary key references auth.users (id) on delete cascade,
  username    text unique,
  full_name   text,
  phone       text,
  avatar_url  text,
  balance     numeric(12, 5) not null default 0 check (balance >= 0),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, username, full_name)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'username', split_part(new.email, '@', 1)),
    new.raw_user_meta_data ->> 'full_name'
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- -------------------------------------------------------------
-- 2. Catalogue de services (synchronisé depuis SMMGen)
-- -------------------------------------------------------------
create table if not exists public.service_categories (
  id         uuid primary key default gen_random_uuid(),
  name       text unique not null,       -- libellé fournisseur, ex. « Instagram Followers »
  slug       text unique not null,
  platform   text,                       -- instagram, tiktok, youtube… (déduit du libellé)
  position   int not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists public.services (
  id                   uuid primary key default gen_random_uuid(),
  provider             text not null default 'smmgen',
  provider_service_id  bigint not null,          -- champ `service` de l'API v2
  name                 text not null,
  type                 text not null default 'Default',  -- Default, Package, Custom Comments…
  category_name        text,
  category_id          uuid references public.service_categories (id) on delete set null,
  platform             text,
  provider_rate        numeric(12, 5) not null,  -- prix fournisseur / 1000
  rate                 numeric(12, 5) not null,  -- prix de vente / 1000 (marge appliquée)
  min                  int not null default 1,
  max                  int not null default 1000000,
  refill               boolean not null default false,
  cancel               boolean not null default false,
  description          text,
  is_active            boolean not null default true,
  synced_at            timestamptz not null default now(),
  created_at           timestamptz not null default now(),
  unique (provider, provider_service_id)
);

create index if not exists services_category_idx on public.services (category_id);
create index if not exists services_platform_idx on public.services (platform);
create index if not exists services_active_idx   on public.services (is_active);
create index if not exists services_name_idx     on public.services using gin (to_tsvector('simple', name));

-- -------------------------------------------------------------
-- 3. Commandes
-- -------------------------------------------------------------
create table if not exists public.orders (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid references auth.users (id) on delete set null,
  status     text not null default 'pending'
             check (status in ('pending', 'processing', 'in_progress', 'completed',
                               'partial', 'canceled', 'refunded')),
  total      numeric(12, 5) not null default 0,
  email      text not null,
  first_name text,
  last_name  text,
  phone      text,
  country    text,
  note       text,
  created_at timestamptz not null default now()
);

create table if not exists public.order_items (
  id                  uuid primary key default gen_random_uuid(),
  order_id            uuid not null references public.orders (id) on delete cascade,
  service_id          uuid references public.services (id) on delete set null,
  provider_service_id bigint,
  service_name        text not null,
  link                text,
  quantity            int not null check (quantity > 0),
  rate                numeric(12, 5) not null,   -- prix / 1000 au moment de la commande
  charge              numeric(12, 5) not null,   -- rate * quantity / 1000
  extras              jsonb not null default '{}'::jsonb,  -- comments, usernames, runs…
  provider_order_id   bigint,                    -- id renvoyé par l'API fournisseur
  status              text not null default 'pending',
  start_count         int,
  remains             int,
  created_at          timestamptz not null default now()
);

create index if not exists orders_user_idx       on public.orders (user_id, created_at desc);
create index if not exists order_items_order_idx on public.order_items (order_id);

-- -------------------------------------------------------------
-- 4. Newsletter et contact
-- -------------------------------------------------------------
create table if not exists public.newsletter_subscribers (
  id         uuid primary key default gen_random_uuid(),
  email      text unique not null,
  created_at timestamptz not null default now()
);

create table if not exists public.contact_messages (
  id         uuid primary key default gen_random_uuid(),
  name       text not null,
  email      text not null,
  subject    text,
  message    text not null,
  created_at timestamptz not null default now()
);

-- -------------------------------------------------------------
-- 5. Statistiques publiques (vue lue par la page d'accueil)
-- -------------------------------------------------------------
create or replace view public.panel_stats as
select
  (select count(*) from public.profiles)                         as users_count,
  (select count(*) from public.services where is_active)         as services_count,
  (select count(*) from public.order_items)                      as orders_count;

-- =============================================================
--  Row Level Security
-- =============================================================
alter table public.profiles               enable row level security;
alter table public.service_categories     enable row level security;
alter table public.services               enable row level security;
alter table public.orders                 enable row level security;
alter table public.order_items            enable row level security;
alter table public.newsletter_subscribers enable row level security;
alter table public.contact_messages       enable row level security;

-- Catalogue : lecture publique, écriture réservée au service_role (script de sync)
drop policy if exists "service categories are public" on public.service_categories;
create policy "service categories are public" on public.service_categories
  for select using (true);

drop policy if exists "services are public" on public.services;
create policy "services are public" on public.services
  for select using (true);

-- Profil : chacun lit et modifie le sien
drop policy if exists "own profile read" on public.profiles;
create policy "own profile read" on public.profiles
  for select using (auth.uid() = id);

drop policy if exists "own profile update" on public.profiles;
create policy "own profile update" on public.profiles
  for update using (auth.uid() = id) with check (auth.uid() = id);

-- Commandes : lecture de ses propres commandes ; création par un visiteur
-- (user_id null) ou par le titulaire du compte.
drop policy if exists "own orders read" on public.orders;
create policy "own orders read" on public.orders
  for select using (auth.uid() = user_id);

drop policy if exists "own orders insert" on public.orders;
create policy "own orders insert" on public.orders
  for insert with check (user_id is null or auth.uid() = user_id);

drop policy if exists "own order items read" on public.order_items;
create policy "own order items read" on public.order_items
  for select using (
    exists (
      select 1 from public.orders o
      where o.id = order_items.order_id and o.user_id = auth.uid()
    )
  );

drop policy if exists "own order items insert" on public.order_items;
create policy "own order items insert" on public.order_items
  for insert with check (
    exists (
      select 1 from public.orders o
      where o.id = order_items.order_id
        and (o.user_id is null or o.user_id = auth.uid())
    )
  );

-- Newsletter et contact : envoi ouvert, aucune lecture publique
drop policy if exists "newsletter insert" on public.newsletter_subscribers;
create policy "newsletter insert" on public.newsletter_subscribers
  for insert with check (true);

drop policy if exists "contact insert" on public.contact_messages;
create policy "contact insert" on public.contact_messages
  for insert with check (true);
