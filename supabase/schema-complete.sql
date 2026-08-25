-- =============================================================
--  SMM67 — schéma complet
--
--  Regroupe schema.sql et les migrations 002 à 006 en un seul script.
--
--  À exécuter dans Supabase Studio > SQL Editor.
--
--  IDEMPOTENT : peut être relancé sans risque sur une base déjà en
--  service. Aucune instruction ne supprime de table ni de donnée. Les
--  deux vues d'agrégats sont recréées à chaque passage — elles ne
--  contiennent rien en propre.
--
--  Ordre imposé par PostgreSQL :
--    1. suppression des vues   (un type de colonne utilisé par une vue
--                               ne peut pas être modifié)
--    2. tables et colonnes
--    3. élargissement des types
--    4. fonctions, déclencheurs, index
--    5. recréation des vues
--    6. RLS et politiques
-- =============================================================

create extension if not exists "pgcrypto";

-- =============================================================
--  0. Vues — supprimées d'abord, recréées en section 7
-- =============================================================
drop view if exists public.admin_topup_requests;
drop view if exists public.admin_order_stats;
drop view if exists public.panel_stats;


-- =============================================================
--  1. Profils (miroir de auth.users)
-- =============================================================
create table if not exists public.profiles (
  id          uuid primary key references auth.users (id) on delete cascade,
  username    text unique,
  full_name   text,
  phone       text,
  avatar_url  text,
  balance     numeric(18, 5) not null default 0 check (balance >= 0),
  role        text not null default 'customer',
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- Bases créées avant la 002 : la colonne peut manquer.
alter table public.profiles
  add column if not exists role text not null default 'customer';

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'profiles_role_check') then
    alter table public.profiles
      add constraint profiles_role_check check (role in ('customer', 'admin', 'support'));
  end if;
end $$;

create index if not exists profiles_role_idx on public.profiles (role);

-- Création automatique du profil à l'inscription.
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
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

/**
 * `security definer` : la fonction lit profiles en contournant la RLS,
 * ce qui évite une récursion infinie dans les politiques qui l'utilisent.
 */
create or replace function public.is_admin()
returns boolean language sql security definer stable set search_path = public as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role in ('admin', 'support')
  );
$$;

revoke all on function public.is_admin() from public;
grant execute on function public.is_admin() to authenticated, anon;


-- =============================================================
--  2. Catalogue de services (synchronisé depuis SMMGen)
-- =============================================================
create table if not exists public.service_categories (
  id         uuid primary key default gen_random_uuid(),
  name       text unique not null,
  slug       text unique not null,
  platform   text,
  position   int not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists public.services (
  id                   uuid primary key default gen_random_uuid(),
  provider             text not null default 'smmgen',
  provider_service_id  bigint not null,
  name                 text not null,
  type                 text not null default 'Default',
  category_name        text,
  category_id          uuid references public.service_categories (id) on delete set null,
  platform             text,
  -- 18,5 et non 12,5 : le catalogue contient des tarifs jusqu'à
  -- ~96 000 000 par millier, qui débordaient à la synchronisation.
  provider_rate        numeric(18, 5) not null,
  rate                 numeric(18, 5) not null,
  min                  int not null default 1,
  max                  int not null default 1000000,
  refill               boolean not null default false,
  cancel               boolean not null default false,
  description          text,
  is_active            boolean not null default true,
  rate_locked          boolean not null default false,
  synced_at            timestamptz not null default now(),
  created_at           timestamptz not null default now(),
  unique (provider, provider_service_id)
);

/**
 * Prix de vente verrouillé.
 * Sans ce drapeau, la synchronisation réécrit `rate` pour toutes les
 * lignes : un prix ajusté à la main était perdu au prochain import.
 */
alter table public.services
  add column if not exists rate_locked boolean not null default false;

comment on column public.services.rate_locked is
  'true = prix de vente fixé manuellement, protégé de la synchronisation.';

create index if not exists services_category_idx    on public.services (category_id);
create index if not exists services_platform_idx    on public.services (platform);
create index if not exists services_active_idx      on public.services (is_active);
create index if not exists services_name_idx        on public.services using gin (to_tsvector('simple', name));
create index if not exists services_rate_locked_idx on public.services (rate_locked) where rate_locked = true;


-- =============================================================
--  3. Commandes
-- =============================================================
create table if not exists public.orders (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid references auth.users (id) on delete set null,
  status          text not null default 'pending',
  total           numeric(18, 5) not null default 0,
  email           text not null,
  first_name      text,
  last_name       text,
  phone           text,
  country         text,
  note            text,
  whatsapp        text,
  idempotency_key text,
  provider_error  text,
  submitted_at    timestamptz,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

alter table public.orders
  add column if not exists updated_at      timestamptz not null default now(),
  add column if not exists idempotency_key text,
  add column if not exists provider_error  text,
  add column if not exists submitted_at    timestamptz,
  add column if not exists whatsapp        text;

comment on column public.orders.whatsapp is
  'Numéro WhatsApp du client, normalisé en chiffres au format international.';

-- `failed` manquait dans la contrainte d'origine.
alter table public.orders drop constraint if exists orders_status_check;
alter table public.orders
  add constraint orders_status_check check (
    status in ('pending', 'processing', 'in_progress', 'completed',
               'partial', 'canceled', 'failed', 'refunded')
  );

-- Empêche la création d'une commande en double lors d'un rejeu de requête.
create unique index if not exists orders_idempotency_idx
  on public.orders (idempotency_key) where idempotency_key is not null;

create table if not exists public.order_items (
  id                  uuid primary key default gen_random_uuid(),
  order_id            uuid not null references public.orders (id) on delete cascade,
  service_id          uuid references public.services (id) on delete set null,
  provider_service_id bigint,
  service_name        text not null,
  link                text,
  quantity            int not null check (quantity > 0),
  rate                numeric(18, 5) not null,
  charge              numeric(18, 5) not null,
  extras              jsonb not null default '{}'::jsonb,
  provider_order_id   bigint,
  status              text not null default 'pending',
  start_count         int,
  remains             int,
  provider_error      text,
  synced_at           timestamptz,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

alter table public.order_items
  add column if not exists updated_at     timestamptz not null default now(),
  add column if not exists provider_error text,
  add column if not exists synced_at      timestamptz;

create index if not exists orders_user_idx        on public.orders (user_id, created_at desc);
create index if not exists orders_status_idx      on public.orders (status, created_at desc);
create index if not exists orders_created_idx     on public.orders (created_at desc);
create index if not exists order_items_order_idx  on public.order_items (order_id);
create index if not exists order_items_provider_idx
  on public.order_items (provider_order_id) where provider_order_id is not null;

-- Horodatage automatique de la dernière modification.
create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
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

-- Journal des changements de statut (traçabilité).
create table if not exists public.order_events (
  id          uuid primary key default gen_random_uuid(),
  order_id    uuid not null references public.orders (id) on delete cascade,
  from_status text,
  to_status   text not null,
  event_type  text,
  source      text not null default 'system',
  actor_id    uuid references auth.users (id) on delete set null,
  note        text,
  created_at  timestamptz not null default now()
);

alter table public.order_events
  add column if not exists event_type text;

comment on column public.order_events.event_type is
  'Événement non lié à un changement de statut : WHATSAPP_CLICKED, …';

create index if not exists order_events_order_idx on public.order_events (order_id, created_at desc);


-- =============================================================
--  4. Favoris
-- =============================================================
create table if not exists public.wishlists (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users (id) on delete cascade,
  service_id uuid not null references public.services (id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (user_id, service_id)
);

create index if not exists wishlists_user_idx on public.wishlists (user_id, created_at desc);


-- =============================================================
--  5. Portefeuille — grand livre
--
--  `profiles.balance` reste le solde courant (lecture rapide), mais
--  toute écriture passe par `wallet_apply`.
-- =============================================================
create table if not exists public.wallet_transactions (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid not null references auth.users (id) on delete cascade,
  type           text not null check (type in ('CREDIT', 'DEBIT', 'REFUND', 'ADJUSTMENT')),
  amount         numeric(18, 5) not null check (amount <> 0),
  balance_before numeric(18, 5) not null,
  balance_after  numeric(18, 5) not null check (balance_after >= 0),
  reason         text,
  order_id       uuid references public.orders (id) on delete set null,
  actor_id       uuid references auth.users (id) on delete set null,
  created_at     timestamptz not null default now()
);

create index if not exists wallet_tx_user_idx  on public.wallet_transactions (user_id, created_at desc);
create index if not exists wallet_tx_order_idx on public.wallet_transactions (order_id);
create index if not exists wallet_tx_type_idx  on public.wallet_transactions (type);

-- Un débit ne doit jamais être enregistré deux fois pour la même commande.
create unique index if not exists wallet_tx_order_debit_idx
  on public.wallet_transactions (order_id) where type = 'DEBIT' and order_id is not null;

/**
 * Application d'un mouvement — opération atomique.
 *
 * `for update` verrouille la ligne de profil : deux commandes
 * simultanées du même client sont sérialisées, ce qui rend la double
 * dépense impossible.
 */
create or replace function public.wallet_apply(
  p_user_id  uuid,
  p_type     text,
  p_amount   numeric,
  p_reason   text default null,
  p_order_id uuid default null,
  p_actor_id uuid default null
)
returns public.wallet_transactions
language plpgsql security definer set search_path = public as $$
declare
  v_before numeric(18, 5);
  v_after  numeric(18, 5);
  v_delta  numeric(18, 5);
  v_row    public.wallet_transactions;
begin
  if p_type not in ('CREDIT', 'DEBIT', 'REFUND', 'ADJUSTMENT') then
    raise exception 'UNKNOWN_TYPE: %', p_type;
  end if;

  if p_amount is null or p_amount = 0 then
    raise exception 'INVALID_AMOUNT';
  end if;

  -- Seul un ajustement peut être signé ; les autres types sont positifs.
  if p_type <> 'ADJUSTMENT' and p_amount < 0 then
    raise exception 'INVALID_AMOUNT';
  end if;

  v_delta := case
    when p_type = 'DEBIT' then -abs(p_amount)
    when p_type = 'ADJUSTMENT' then p_amount
    else abs(p_amount)
  end;

  select balance into v_before from public.profiles where id = p_user_id for update;

  if not found then
    raise exception 'UNKNOWN_WALLET';
  end if;

  v_after := v_before + v_delta;

  if v_after < 0 then
    raise exception 'INSUFFICIENT_FUNDS';
  end if;

  update public.profiles set balance = v_after, updated_at = now() where id = p_user_id;

  insert into public.wallet_transactions
    (user_id, type, amount, balance_before, balance_after, reason, order_id, actor_id)
  values
    (p_user_id, p_type, v_delta, v_before, v_after, p_reason, p_order_id, p_actor_id)
  returning * into v_row;

  return v_row;
end;
$$;

-- La fonction n'est appelable que par les routes serveur protégées.
revoke all on function public.wallet_apply(uuid, text, numeric, text, uuid, uuid)
  from public, anon, authenticated;
grant execute on function public.wallet_apply(uuid, text, numeric, text, uuid, uuid)
  to service_role;


-- =============================================================
--  6. Demandes de recharge
--
--  Le panel n'a pas d'encaissement automatique : une recharge est
--  confirmée à la main. Sans trace en base, l'information n'existait
--  que dans une conversation WhatsApp.
-- =============================================================
create table if not exists public.topup_requests (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid not null references auth.users (id) on delete cascade,
  amount         numeric(18, 5) not null check (amount > 0),

  -- Bonus promotionnel, calculé côté serveur au dépôt de la demande et
  -- figé : une évolution du barème ne change pas ce qui a été promis.
  bonus          numeric(18, 5) not null default 0 check (bonus >= 0),

  status         text not null default 'pending'
                   check (status in ('pending', 'approved', 'rejected', 'canceled')),
  method         text not null default 'whatsapp'
                   check (method in ('whatsapp', 'manual', 'online')),

  whatsapp       text,
  note           text,
  -- Instantané de l'adresse : le reste du schéma n'interroge jamais
  -- `auth.users` en SQL, on garde cette règle.
  email          text,

  reviewed_by    uuid references auth.users (id) on delete set null,
  reviewed_at    timestamptz,
  review_note    text,
  transaction_id uuid references public.wallet_transactions (id) on delete set null,

  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

alter table public.topup_requests
  add column if not exists bonus numeric(18, 5) not null default 0,
  add column if not exists email text;

create index if not exists topup_requests_user_idx
  on public.topup_requests (user_id, created_at desc);

create index if not exists topup_requests_pending_idx
  on public.topup_requests (created_at desc) where status = 'pending';

drop trigger if exists topup_requests_touch_updated_at on public.topup_requests;
create trigger topup_requests_touch_updated_at
  before update on public.topup_requests
  for each row execute function public.touch_updated_at();

/**
 * Une demande tranchée ne peut pas l'être une seconde fois : elle a déjà
 * crédité un portefeuille, la rouvrir permettrait un double crédit.
 */
create or replace function public.protect_topup_status()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if old.status in ('approved', 'rejected', 'canceled') and new.status <> old.status then
    raise exception 'TOPUP_ALREADY_SETTLED';
  end if;
  return new;
end;
$$;

drop trigger if exists topup_requests_protect_status on public.topup_requests;
create trigger topup_requests_protect_status
  before update on public.topup_requests
  for each row execute function public.protect_topup_status();


-- =============================================================
--  7. Newsletter et contact
-- =============================================================
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


-- =============================================================
--  8. Élargissement des colonnes monétaires
--
--  Sans effet sur une base neuve (le type est déjà correct) ; corrige
--  les bases créées avant la 003, où numeric(12,5) provoquait
--  « numeric field overflow » à la synchronisation du catalogue.
-- =============================================================
alter table public.services
  alter column provider_rate type numeric(18, 5),
  alter column rate          type numeric(18, 5);

alter table public.order_items
  alter column rate   type numeric(18, 5),
  alter column charge type numeric(18, 5);

alter table public.orders
  alter column total type numeric(18, 5);

alter table public.profiles
  alter column balance type numeric(18, 5);


-- =============================================================
--  9. Vues
-- =============================================================

-- Compteurs de la page d'accueil : lecture publique assumée.
create view public.panel_stats as
select
  (select count(*) from public.profiles)                 as users_count,
  (select count(*) from public.services where is_active) as services_count,
  (select count(*) from public.order_items)              as orders_count;

-- Agrégats d'administration — aucune donnée nominative.
create view public.admin_order_stats as
select
  count(*)                                                        as total_orders,
  count(*) filter (where status = 'pending')                      as pending_orders,
  count(*) filter (where status in ('processing', 'in_progress')) as processing_orders,
  count(*) filter (where status = 'completed')                    as completed_orders,
  count(*) filter (where status = 'canceled')                     as canceled_orders,
  count(*) filter (where status = 'failed')                       as failed_orders,
  count(*) filter (where status = 'partial')                      as partial_orders,
  coalesce(sum(total), 0)                                         as total_revenue,
  coalesce(sum(total) filter (where status = 'completed'), 0)     as completed_revenue
from public.orders;

-- File d'attente des recharges : demande + identité du client.
create view public.admin_topup_requests
with (security_invoker = true) as
select
  r.id,
  r.user_id,
  r.amount,
  r.bonus,
  r.status,
  r.method,
  r.whatsapp,
  r.note,
  r.email,
  r.review_note,
  r.reviewed_at,
  r.created_at,
  p.username,
  p.full_name,
  p.balance
from public.topup_requests r
join public.profiles p on p.id = r.user_id;

-- Une vue ne porte pas de RLS : l'accès aux agrégats d'administration
-- est retiré aux rôles publics. `panel_stats` reste public (accueil).
revoke all on public.admin_order_stats    from anon, authenticated;
revoke all on public.admin_topup_requests from anon, authenticated;


-- =============================================================
--  10. Row Level Security
-- =============================================================
alter table public.profiles               enable row level security;
alter table public.service_categories     enable row level security;
alter table public.services               enable row level security;
alter table public.orders                 enable row level security;
alter table public.order_items            enable row level security;
alter table public.order_events           enable row level security;
alter table public.wishlists              enable row level security;
alter table public.wallet_transactions    enable row level security;
alter table public.topup_requests         enable row level security;
alter table public.newsletter_subscribers enable row level security;
alter table public.contact_messages       enable row level security;

-- ---------- Catalogue : lecture publique, écriture admin ----------
drop policy if exists "service categories are public" on public.service_categories;
create policy "service categories are public" on public.service_categories
  for select using (true);

drop policy if exists "services are public" on public.services;
create policy "services are public" on public.services
  for select using (true);

drop policy if exists "admin services write" on public.services;
create policy "admin services write" on public.services
  for update using (public.is_admin()) with check (public.is_admin());

-- ---------- Profils : le sien, ou tout pour un administrateur ----------
drop policy if exists "own profile read" on public.profiles;
create policy "own profile read" on public.profiles
  for select using (auth.uid() = id or public.is_admin());

drop policy if exists "own profile update" on public.profiles;
create policy "own profile update" on public.profiles
  for update using (auth.uid() = id) with check (auth.uid() = id);

/**
 * Le rôle n'est jamais modifiable par le client.
 *
 * `auth.uid() is null` = contexte service_role ou éditeur SQL, déjà de
 * confiance — sans cette exception, promouvoir un administrateur
 * deviendrait impossible. Un client authentifié ne peut pas
 * s'auto-promouvoir.
 */
create or replace function public.protect_profile_role()
returns trigger language plpgsql security definer set search_path = public as $$
begin
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

/** Le solde ne se modifie que par `wallet_apply`. */
create or replace function public.protect_profile_balance()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.balance is distinct from old.balance and auth.uid() is not null then
    raise exception 'balance can only be changed through wallet_apply';
  end if;
  return new;
end;
$$;

drop trigger if exists profiles_protect_balance on public.profiles;
create trigger profiles_protect_balance
  before update on public.profiles
  for each row execute function public.protect_profile_balance();

-- ---------- Commandes ----------
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

drop policy if exists "order events read" on public.order_events;
create policy "order events read" on public.order_events
  for select using (
    public.is_admin()
    or exists (
      select 1 from public.orders o
      where o.id = order_events.order_id and o.user_id = auth.uid()
    )
  );

-- ---------- Favoris : strictement personnels ----------
drop policy if exists "own wishlist read" on public.wishlists;
create policy "own wishlist read" on public.wishlists
  for select using (auth.uid() = user_id or public.is_admin());

drop policy if exists "own wishlist insert" on public.wishlists;
create policy "own wishlist insert" on public.wishlists
  for insert with check (auth.uid() = user_id);

drop policy if exists "own wishlist delete" on public.wishlists;
create policy "own wishlist delete" on public.wishlists
  for delete using (auth.uid() = user_id);

-- ---------- Portefeuille : lecture seule ----------
-- Aucune politique d'écriture : le grand livre n'est alimenté que par
-- `wallet_apply` via la clé service_role. Il est donc inaltérable depuis
-- le navigateur, y compris pour un administrateur.
drop policy if exists "own wallet transactions read" on public.wallet_transactions;
create policy "own wallet transactions read" on public.wallet_transactions
  for select using (auth.uid() = user_id or public.is_admin());

-- ---------- Demandes de recharge ----------
drop policy if exists topup_requests_select on public.topup_requests;
create policy topup_requests_select on public.topup_requests
  for select using (auth.uid() = user_id or public.is_admin());

-- Le client crée ses propres demandes, toujours à l'état « pending ».
-- Il ne peut ni s'auto-approuver ni créer une demande pour autrui.
drop policy if exists topup_requests_insert on public.topup_requests;
create policy topup_requests_insert on public.topup_requests
  for insert with check (
    auth.uid() = user_id
    and status = 'pending'
    and reviewed_by is null
    and transaction_id is null
  );

-- Une seule action côté client : annuler sa demande encore ouverte.
drop policy if exists topup_requests_cancel on public.topup_requests;
create policy topup_requests_cancel on public.topup_requests
  for update using (auth.uid() = user_id and status = 'pending')
  with check (auth.uid() = user_id and status in ('pending', 'canceled'));

drop policy if exists topup_requests_admin_update on public.topup_requests;
create policy topup_requests_admin_update on public.topup_requests
  for update using (public.is_admin()) with check (public.is_admin());

drop policy if exists topup_requests_admin_delete on public.topup_requests;
create policy topup_requests_admin_delete on public.topup_requests
  for delete using (public.is_admin());

-- ---------- Newsletter et contact : envoi ouvert, lecture admin ----------
drop policy if exists "newsletter insert" on public.newsletter_subscribers;
create policy "newsletter insert" on public.newsletter_subscribers
  for insert with check (true);

drop policy if exists "admin newsletter read" on public.newsletter_subscribers;
create policy "admin newsletter read" on public.newsletter_subscribers
  for select using (public.is_admin());

drop policy if exists "contact insert" on public.contact_messages;
create policy "contact insert" on public.contact_messages
  for insert with check (true);

drop policy if exists "admin contact read" on public.contact_messages;
create policy "admin contact read" on public.contact_messages
  for select using (public.is_admin());


-- =============================================================
--  11. Promotion d'un administrateur
--
--  À exécuter séparément, une seule fois, avec votre adresse.
-- =============================================================
-- update public.profiles set role = 'admin'
-- where id = (select id from auth.users where email = 'smm67official@gmail.com');
