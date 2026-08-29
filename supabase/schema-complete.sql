-- =============================================================
--  SMM67 — schéma complet
--
--  Regroupe schema.sql et les migrations 002 à 012 en un seul script.
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


/*
  Le nom d'origine est conservé à part plutôt que remplacé.

  `services.name` reste ce que voit le client : rien à changer dans les
  pages, le panier ou les tableaux. `provider_name` garde le libellé du
  fournisseur, qui sert à retrouver un service dans son back-office ou
  auprès de son support — une information qu'un simple écrasement aurait
  fait disparaître, et qu'aucune synchronisation ne pourrait restituer
  une fois le service retiré du catalogue.
*/
alter table public.services
  add column if not exists provider_name text,
  add column if not exists name_locked   boolean not null default false;

-- Services déjà importés : le nom actuel EST le nom fournisseur.
update public.services
   set provider_name = name
 where provider_name is null;

comment on column public.services.provider_name is
  'Libellé d''origine chez le fournisseur, toujours synchronisé.';
comment on column public.services.name_locked is
  'true = nom réécrit par un administrateur, protégé de la synchronisation.';

create index if not exists services_name_locked_idx
  on public.services (name_locked) where name_locked = true;

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
--  11. Paramètres — numéros WhatsApp et moyens de paiement
--
--  Le numéro WhatsApp vivait dans une variable d'environnement, donc
--  figé au build : le changer imposait un redéploiement. Les moyens de
--  paiement n'existaient nulle part. Les deux sont administrables.
-- =============================================================

-- -------------------------------------------------------------
-- 1. Numéros WhatsApp — un seul actif à la fois
-- -------------------------------------------------------------
create table if not exists public.whatsapp_numbers (
  id         uuid primary key default gen_random_uuid(),

  -- Libellé interne : « Support », « Ventes »… jamais montré au client.
  label      text not null,

  -- Chiffres uniquement, format international sans « + » : c'est ce
  -- qu'attend wa.me. La normalisation est faite côté application.
  number     text not null check (number ~ '^[0-9]{8,15}$'),

  note       text,
  is_active  boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

/*
  « Un seul numéro actif » est une règle métier : elle est tenue par la
  base, pas par l'interface. L'index partiel n'autorise qu'une seule
  ligne où `is_active` vaut true ; une seconde activation échoue même si
  elle vient d'un autre onglet, d'un script ou de l'éditeur SQL.
*/
create unique index if not exists whatsapp_numbers_single_active
  on public.whatsapp_numbers ((is_active)) where is_active;

create index if not exists whatsapp_numbers_created_idx
  on public.whatsapp_numbers (created_at desc);

drop trigger if exists whatsapp_numbers_touch_updated_at on public.whatsapp_numbers;
create trigger whatsapp_numbers_touch_updated_at
  before update on public.whatsapp_numbers
  for each row execute function public.touch_updated_at();

/**
 * Bascule du numéro actif.
 *
 * En deux instructions (désactiver puis activer), l'index unique
 * ci-dessus rejette l'opération dès qu'elles s'entrelacent, et une
 * panne entre les deux laisserait le panel sans aucun numéro. La
 * fonction les exécute dans la même transaction : il y a toujours
 * exactement un actif, avant comme après.
 */
create or replace function public.activate_whatsapp_number(p_id uuid)
returns public.whatsapp_numbers
language plpgsql security definer set search_path = public as $$
declare
  v_row public.whatsapp_numbers;
begin
  update public.whatsapp_numbers set is_active = false
   where is_active and id <> p_id;

  update public.whatsapp_numbers set is_active = true
   where id = p_id
  returning * into v_row;

  if not found then
    raise exception 'UNKNOWN_WHATSAPP_NUMBER';
  end if;

  return v_row;
end;
$$;

revoke all on function public.activate_whatsapp_number(uuid) from public, anon, authenticated;
grant execute on function public.activate_whatsapp_number(uuid) to service_role;

-- -------------------------------------------------------------
-- 2. Moyens de paiement — plusieurs actifs simultanément
-- -------------------------------------------------------------
create table if not exists public.payment_methods (
  id             uuid primary key default gen_random_uuid(),
  name           text not null check (length(btrim(name)) > 0),

  -- Numéro de compte, de téléphone ou identifiant chez l'opérateur.
  account_number text,

  -- Relevé d'identité bancaire, seulement pour un virement.
  rib            text,

  -- URL publique de l'icône (stockage Supabase). Nulle = pastille par défaut.
  icon_url       text,

  -- Consignes libres affichées au client sous le moyen de paiement.
  instructions   text,

  position       int not null default 0,
  is_active      boolean not null default true,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

/*
  Un moyen de paiement sans coordonnées n'est pas actionnable : le client
  verrait un nom et rien pour payer. Au moins un des deux champs doit
  être renseigné.
*/
alter table public.payment_methods drop constraint if exists payment_methods_reachable_check;
alter table public.payment_methods
  add constraint payment_methods_reachable_check check (
    coalesce(btrim(account_number), '') <> '' or coalesce(btrim(rib), '') <> ''
  );

create index if not exists payment_methods_active_idx
  on public.payment_methods (position, created_at) where is_active;

drop trigger if exists payment_methods_touch_updated_at on public.payment_methods;
create trigger payment_methods_touch_updated_at
  before update on public.payment_methods
  for each row execute function public.touch_updated_at();

-- -------------------------------------------------------------
-- 3. Row Level Security
-- -------------------------------------------------------------
alter table public.whatsapp_numbers enable row level security;
alter table public.payment_methods  enable row level security;

/*
  Le numéro actif est un contact commercial : il figure déjà sur les
  pages publiques. Seul l'actif est lisible — la liste complète des
  numéros de secours reste interne.
*/
drop policy if exists whatsapp_active_public on public.whatsapp_numbers;
create policy whatsapp_active_public on public.whatsapp_numbers
  for select using (is_active);

drop policy if exists whatsapp_admin_read on public.whatsapp_numbers;
create policy whatsapp_admin_read on public.whatsapp_numbers
  for select using (public.is_admin());

/*
  Les moyens de paiement portent des RIB et des numéros de compte. Ils
  sont réservés aux comptes connectés : un visiteur n'a aucune raison de
  les collecter, et la recharge suppose de toute façon un compte.
*/
drop policy if exists payment_methods_active_read on public.payment_methods;
create policy payment_methods_active_read on public.payment_methods
  for select to authenticated using (is_active);

drop policy if exists payment_methods_admin_read on public.payment_methods;
create policy payment_methods_admin_read on public.payment_methods
  for select using (public.is_admin());

/*
  Aucune politique d'écriture, volontairement : les deux tables ne sont
  modifiées que par les routes d'administration, via la clé service_role.
  Elles sont donc inaltérables depuis un navigateur, y compris par un
  administrateur dont la session serait détournée.
*/


-- =============================================================
--  12. Contrôle du solde, blocage des comptes, journal d'audit
-- =============================================================
--  1. Solde fournisseur : ce que l'on peut réellement engager
--
--  L'API SMMGen expose `action=balance` en LECTURE SEULE. Il n'existe
--  aucun appel pour en retirer ou y reverser des fonds : ce solde ne
--  bouge que lorsqu'une commande est réellement passée chez eux.
--
--  « Retirer le montant du solde SMMGen » n'est donc pas réalisable au
--  sens littéral. Ce qui l'est, et qui porte la même règle métier :
--  suivre ce que la plateforme a DÉJÀ ENGAGÉ auprès de ses clients, et
--  refuser d'engager au-delà du solde fournisseur constaté.
--
--      disponible à l'allocation = solde SMMGen - somme des soldes clients
--
--  C'est ce « disponible » qui décroît quand on crédite un client, et
--  qui remonte quand on reprend du solde. L'invariant protégé est :
--
--      somme des soldes clients <= solde SMMGen
--
--  soit exactement « ne jamais allouer plus que ce que le fournisseur
--  détient réellement ».
-- =============================================================

/*
  Relevés du solde fournisseur.

  Conservés plutôt que recalculés : ils datent la dernière lecture
  réussie, ce qui permet de distinguer une valeur temps réel d'une
  valeur périmée, et de constater après coup ce que l'on croyait
  disponible au moment d'une allocation.
*/
create table if not exists public.provider_balance_snapshots (
  id          uuid primary key default gen_random_uuid(),
  provider    text not null default 'smmgen',

  -- Null quand la lecture a échoué : on garde la trace de l'échec.
  balance     numeric(18, 5),
  currency    text,

  status      text not null default 'LIVE' check (status in ('LIVE', 'ERROR')),
  error       text,

  -- Ce que la plateforme avait engagé à cet instant, pour rejouer un
  -- écart sans dépendre de l'état courant des profils.
  allocated   numeric(18, 5),

  checked_by  uuid references auth.users (id) on delete set null,
  created_at  timestamptz not null default now()
);

create index if not exists provider_snapshots_recent_idx
  on public.provider_balance_snapshots (provider, created_at desc);

create index if not exists provider_snapshots_ok_idx
  on public.provider_balance_snapshots (provider, created_at desc) where status = 'LIVE';


-- =============================================================
--  2. Grand livre enrichi
-- =============================================================

/*
  Colonnes ajoutées, aucune remplacée.

  `provider_balance_*` fige ce que valait le solde fournisseur de part
  et d'autre du mouvement : sans cela, un écart constaté plus tard ne
  peut plus être rattaché à l'opération qui l'a causé.
*/
alter table public.wallet_transactions
  add column if not exists provider_balance_before numeric(18, 5),
  add column if not exists provider_balance_after  numeric(18, 5),
  add column if not exists status   text not null default 'SUCCESS',
  add column if not exists metadata jsonb not null default '{}'::jsonb,
  add column if not exists reference text;

alter table public.wallet_transactions drop constraint if exists wallet_transactions_status_check;
alter table public.wallet_transactions
  add constraint wallet_transactions_status_check
  check (status in ('SUCCESS', 'FAILED', 'PENDING'));

/*
  Types élargis.

  Les quatre types d'origine restent valides — ils portent les
  mouvements déjà enregistrés (débit de commande, crédit de recharge) et
  le code existant continue de les écrire. Les deux nouveaux distinguent
  ce qui est adossé au solde fournisseur.
*/
alter table public.wallet_transactions drop constraint if exists wallet_transactions_type_check;
alter table public.wallet_transactions
  add constraint wallet_transactions_type_check check (
    type in ('CREDIT', 'DEBIT', 'REFUND', 'ADJUSTMENT',
             'BALANCE_ALLOCATION', 'BALANCE_RECLAIM')
  );

-- Une référence, quand elle est posée, désigne une opération unique.
create unique index if not exists wallet_tx_reference_idx
  on public.wallet_transactions (reference) where reference is not null;

create index if not exists wallet_tx_created_idx
  on public.wallet_transactions (created_at desc);


-- =============================================================
--  3. Allocation et reprise — atomiques et sérialisées
-- =============================================================

/**
 * Verrou d'allocation.
 *
 * `pg_advisory_xact_lock` sérialise toutes les allocations entre elles,
 * pour toute la durée de la transaction. Sans lui, deux administrateurs
 * lisant simultanément « 700 disponibles » pourraient accorder 500
 * chacun : chacun verrait son contrôle passer, et le total dépasserait
 * le solde fournisseur. Le verrou est relâché automatiquement au
 * `commit` comme au `rollback`.
 *
 * La clé est arbitraire mais constante : c'est la même pour tous les
 * appelants, c'est ce qui les met en file.
 */
create or replace function public.balance_lock_key()
returns bigint language sql immutable as $$
  select hashtext('smm67.balance.allocation')::bigint;
$$;

/**
 * Total engagé auprès des clients.
 *
 * Somme des soldes, et non somme du grand livre : le solde est la valeur
 * qui fait foi, le grand livre en est l'historique. Les deux sont
 * comparés par la vérification de cohérence, plus bas.
 */
create or replace function public.total_allocated_balance()
returns numeric language sql stable security definer set search_path = public as $$
  select coalesce(sum(balance), 0)::numeric(18, 5) from public.profiles;
$$;

/**
 * Allocation de solde à un client, adossée au solde fournisseur.
 *
 * `p_provider_balance` est lu par le serveur juste avant l'appel : la
 * base ne peut pas interroger une API externe. Il est passé ici pour que
 * le contrôle et l'écriture se fassent dans la MÊME transaction, sous le
 * même verrou — vérifier côté serveur puis écrire séparément rouvrirait
 * la fenêtre que le verrou ferme.
 */
create or replace function public.allocate_balance(
  p_user_id   uuid,
  p_amount    numeric,
  p_provider_balance numeric,
  p_actor_id  uuid,
  p_reason    text default null,
  p_reference text default null,
  p_metadata  jsonb default '{}'::jsonb
)
returns public.wallet_transactions
language plpgsql security definer set search_path = public as $$
declare
  v_before    numeric(18, 5);
  v_after     numeric(18, 5);
  v_allocated numeric(18, 5);
  v_available numeric(18, 5);
  v_row       public.wallet_transactions;
begin
  if p_amount is null or p_amount <= 0 then
    raise exception 'INVALID_AMOUNT';
  end if;

  if p_provider_balance is null or p_provider_balance < 0 then
    raise exception 'PROVIDER_BALANCE_UNKNOWN';
  end if;

  -- Met en file toutes les allocations concurrentes.
  perform pg_advisory_xact_lock(public.balance_lock_key());

  select balance into v_before from public.profiles where id = p_user_id for update;
  if not found then
    raise exception 'UNKNOWN_WALLET';
  end if;

  v_allocated := public.total_allocated_balance();
  v_available := p_provider_balance - v_allocated;

  -- La règle métier, tenue ici et nulle part ailleurs.
  if p_amount > v_available then
    raise exception 'INSUFFICIENT_PROVIDER_BALANCE: available %, requested %',
      v_available, p_amount;
  end if;

  v_after := v_before + p_amount;

  update public.profiles
     set balance = v_after, updated_at = now()
   where id = p_user_id;

  insert into public.wallet_transactions
    (user_id, type, amount, balance_before, balance_after, reason, actor_id,
     provider_balance_before, provider_balance_after, status, reference, metadata)
  values
    (p_user_id, 'BALANCE_ALLOCATION', p_amount, v_before, v_after, p_reason, p_actor_id,
     -- « Avant / après » du DISPONIBLE, pas du solde brut du fournisseur :
     -- c'est le chiffre qui bouge et que l'administrateur voit décroître.
     v_available, v_available - p_amount, 'SUCCESS', p_reference, coalesce(p_metadata, '{}'::jsonb))
  returning * into v_row;

  return v_row;
end;
$$;

/**
 * Reprise de solde : l'inverse exact, sans contrôle fournisseur.
 *
 * Reprendre du solde ne consomme rien chez le fournisseur — cela libère
 * au contraire du disponible. Le seul garde-fou utile est le solde du
 * client, qui ne doit jamais passer sous zéro.
 */
create or replace function public.reclaim_balance(
  p_user_id   uuid,
  p_amount    numeric,
  p_provider_balance numeric,
  p_actor_id  uuid,
  p_reason    text default null,
  p_reference text default null,
  p_metadata  jsonb default '{}'::jsonb
)
returns public.wallet_transactions
language plpgsql security definer set search_path = public as $$
declare
  v_before    numeric(18, 5);
  v_after     numeric(18, 5);
  v_allocated numeric(18, 5);
  v_available numeric(18, 5);
  v_row       public.wallet_transactions;
begin
  if p_amount is null or p_amount <= 0 then
    raise exception 'INVALID_AMOUNT';
  end if;

  perform pg_advisory_xact_lock(public.balance_lock_key());

  select balance into v_before from public.profiles where id = p_user_id for update;
  if not found then
    raise exception 'UNKNOWN_WALLET';
  end if;

  if p_amount > v_before then
    raise exception 'INSUFFICIENT_CLIENT_BALANCE: balance %, requested %', v_before, p_amount;
  end if;

  v_after := v_before - p_amount;

  update public.profiles
     set balance = v_after, updated_at = now()
   where id = p_user_id;

  v_allocated := public.total_allocated_balance();
  v_available := coalesce(p_provider_balance, 0) - v_allocated;

  insert into public.wallet_transactions
    (user_id, type, amount, balance_before, balance_after, reason, actor_id,
     provider_balance_before, provider_balance_after, status, reference, metadata)
  values
    (p_user_id, 'BALANCE_RECLAIM', -p_amount, v_before, v_after, p_reason, p_actor_id,
     v_available - p_amount, v_available, 'SUCCESS', p_reference, coalesce(p_metadata, '{}'::jsonb))
  returning * into v_row;

  return v_row;
end;
$$;

revoke all on function public.allocate_balance(uuid, numeric, numeric, uuid, text, text, jsonb)
  from public, anon, authenticated;
grant execute on function public.allocate_balance(uuid, numeric, numeric, uuid, text, text, jsonb)
  to service_role;

revoke all on function public.reclaim_balance(uuid, numeric, numeric, uuid, text, text, jsonb)
  from public, anon, authenticated;
grant execute on function public.reclaim_balance(uuid, numeric, numeric, uuid, text, text, jsonb)
  to service_role;

revoke all on function public.total_allocated_balance() from public, anon, authenticated;
grant execute on function public.total_allocated_balance() to service_role;


-- =============================================================
--  4. Blocage de compte
-- =============================================================
alter table public.profiles
  add column if not exists is_blocked   boolean not null default false,
  add column if not exists blocked_at   timestamptz,
  add column if not exists blocked_by   uuid references auth.users (id) on delete set null,
  add column if not exists block_reason text;

create index if not exists profiles_blocked_idx on public.profiles (is_blocked) where is_blocked;

comment on column public.profiles.is_blocked is
  'true = compte suspendu ; refusé à la connexion et par les politiques d''écriture.';

/**
 * Le blocage n'est pas modifiable par le client.
 *
 * `own profile update` autorise un client à mettre à jour SA ligne. Sans
 * ce contrôle, il lui suffirait d'y écrire `is_blocked = false` pour se
 * débloquer lui-même. Même raisonnement que pour `role` et `balance`.
 */
create or replace function public.protect_profile_block()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if (new.is_blocked is distinct from old.is_blocked
      or new.block_reason is distinct from old.block_reason)
     and auth.uid() is not null
     and not public.is_admin() then
    raise exception 'blocking can only be changed by an administrator';
  end if;
  return new;
end;
$$;

drop trigger if exists profiles_protect_block on public.profiles;
create trigger profiles_protect_block
  before update on public.profiles
  for each row execute function public.protect_profile_block();

/**
 * Un compte bloqué ne commande plus.
 *
 * Le contrôle applicatif renvoie un message clair, mais il ne suffit
 * pas : une requête forgée avec le jeton d'un compte bloqué le
 * contournerait. La politique d'insertion porte donc elle aussi la
 * condition — c'est la couche qu'on ne peut pas court-circuiter.
 */
create or replace function public.is_blocked()
returns boolean language sql security definer stable set search_path = public as $$
  select coalesce(
    (select is_blocked from public.profiles where id = auth.uid()),
    false
  );
$$;

revoke all on function public.is_blocked() from public;
grant execute on function public.is_blocked() to authenticated, anon;

drop policy if exists "own orders insert" on public.orders;
create policy "own orders insert" on public.orders
  for insert with check (auth.uid() = user_id and not public.is_blocked());

drop policy if exists topup_requests_insert on public.topup_requests;
create policy topup_requests_insert on public.topup_requests
  for insert with check (
    auth.uid() = user_id
    and status = 'pending'
    and reviewed_by is null
    and transaction_id is null
    and not public.is_blocked()
  );


-- =============================================================
--  5. Journal d'audit
-- =============================================================
create table if not exists public.audit_logs (
  id         uuid primary key default gen_random_uuid(),

  action     text not null,

  -- Auteur de l'action. Null pour un événement système (synchronisation
  -- planifiée), ce qui est une information en soi.
  actor_id   uuid references auth.users (id) on delete set null,

  -- Cible : compte concerné, commande, service…
  target_id  uuid,
  target_type text,

  amount     numeric(18, 5),

  /*
    Contexte libre. N'y placer AUCUN secret : ni mot de passe, ni jeton
    OAuth, ni clé d'API. Le journal est lisible par tout administrateur
    et n'est jamais purgé.
  */
  metadata   jsonb not null default '{}'::jsonb,

  ip         text,
  created_at timestamptz not null default now()
);

create index if not exists audit_logs_recent_idx on public.audit_logs (created_at desc);
create index if not exists audit_logs_action_idx on public.audit_logs (action, created_at desc);
create index if not exists audit_logs_actor_idx  on public.audit_logs (actor_id, created_at desc);
create index if not exists audit_logs_target_idx on public.audit_logs (target_id, created_at desc);


-- =============================================================
--  6. Row Level Security
-- =============================================================
alter table public.provider_balance_snapshots enable row level security;
alter table public.audit_logs                 enable row level security;

-- Lecture réservée à l'administration ; écriture par la clé de service
-- uniquement, donc aucune politique d'écriture (le journal doit rester
-- inaltérable depuis un navigateur).
drop policy if exists provider_snapshots_admin_read on public.provider_balance_snapshots;
create policy provider_snapshots_admin_read on public.provider_balance_snapshots
  for select using (public.is_admin());

drop policy if exists audit_logs_admin_read on public.audit_logs;
create policy audit_logs_admin_read on public.audit_logs
  for select using (public.is_admin());


-- =============================================================
--  13. Réglages généraux et marges de service
-- =============================================================
--  1. Réglages généraux — une seule ligne
--
--  Aucune table de réglages n'existait : le numéro WhatsApp vit dans
--  `whatsapp_numbers`, la marge dans une variable d'environnement
--  (`SMM_MARKUP_PERCENT`), donc figée au build et invisible depuis le
--  back-office.
--
--  Le numéro N'EST PAS recopié ici : `whatsapp_numbers` reste la seule
--  source, avec sa règle « un seul actif ». Dupliquer la valeur créerait
--  deux vérités à tenir d'accord.
-- =============================================================
create table if not exists public.app_settings (
  /*
    Ligne unique.

    `id` vaut toujours `true` et la contrainte l'exige : la clé primaire
    rend alors une seconde ligne impossible. Sans ce garde-fou, un
    `insert` de trop créerait un second jeu de réglages et le code lirait
    l'un ou l'autre selon l'ordre de tri.
  */
  id boolean primary key default true check (id),

  -- --- Marge de vente ---------------------------------------------
  -- Bornée : au-delà de 1000 %, c'est une faute de frappe, pas une
  -- décision commerciale.
  global_service_margin numeric(6, 2) not null default 20
    check (global_service_margin >= 0 and global_service_margin <= 1000),

  -- --- Widget WhatsApp --------------------------------------------
  whatsapp_enabled  boolean not null default true,
  whatsapp_message  text,
  whatsapp_greeting text,
  whatsapp_position text not null default 'bottom-right'
    check (whatsapp_position in ('bottom-right', 'bottom-left')),

  -- --- Envoi des commandes ----------------------------------------
  -- `false` par défaut : pour un réglage qui engage de l'argent réel,
  -- le défaut doit être l'inaction.
  auto_submit_orders boolean not null default false,

  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users (id) on delete set null
);

/*
  Valeur initiale de la marge.

  Reprise de `SMM_MARKUP_PERCENT` si la variable a servi, sinon 20 —
  la valeur qu'appliquait le code par défaut. Le catalogue existant a
  été importé avec cette marge : partir d'autre chose ferait bouger tous
  les prix à la première synchronisation.
*/
insert into public.app_settings (id) values (true) on conflict (id) do nothing;

drop trigger if exists app_settings_touch_updated_at on public.app_settings;
create trigger app_settings_touch_updated_at
  before update on public.app_settings
  for each row execute function public.touch_updated_at();


-- =============================================================
--  2. Marge par service
-- =============================================================
alter table public.services
  add column if not exists margin_mode text not null default 'global',

  -- Null quand le service suit la marge globale. C'est cette colonne,
  -- et elle seule, qui décide : `margin_mode` n'en est que le reflet
  -- lisible dans l'interface.
  add column if not exists custom_margin numeric(6, 2);

alter table public.services drop constraint if exists services_margin_mode_check;
alter table public.services
  add constraint services_margin_mode_check check (margin_mode in ('global', 'custom'));

alter table public.services drop constraint if exists services_custom_margin_check;
alter table public.services
  add constraint services_custom_margin_check check (
    custom_margin is null or (custom_margin >= 0 and custom_margin <= 1000)
  );

-- Cohérence entre les deux colonnes : « custom » exige une valeur,
-- « global » interdit d'en garder une qui ne s'appliquerait pas.
alter table public.services drop constraint if exists services_margin_pair_check;
alter table public.services
  add constraint services_margin_pair_check check (
    (margin_mode = 'custom' and custom_margin is not null)
    or (margin_mode = 'global' and custom_margin is null)
  );

create index if not exists services_margin_mode_idx
  on public.services (margin_mode) where margin_mode = 'custom';


-- =============================================================
--  3. Reprise des prix fixés à la main
--
--  `rate_locked` (migration 005) protégeait un PRIX ABSOLU de la
--  synchronisation. La marge exprime la même intention — « ce service
--  ne suit pas le tarif automatique » — mais résiste à un changement de
--  coût fournisseur : un prix figé devient une marge négative le jour
--  où le fournisseur augmente.
--
--  On convertit donc chaque prix verrouillé en la marge qu'il
--  représentait. Aucun prix ne bouge à la conversion ; ils cesseront
--  simplement d'être figés.
--
--  Les deux mécanismes ne coexistent pas : la marge devient la seule
--  logique de tarification.
-- =============================================================
update public.services
   set margin_mode   = 'custom',
       custom_margin = least(
         1000,
         greatest(0, round(((rate / nullif(provider_rate, 0)) - 1) * 100, 2))
       )
 where rate_locked = true
   and provider_rate > 0
   and custom_margin is null;

-- Un prix verrouillé sur un coût fournisseur nul n'est pas convertible :
-- il repasse en marge globale plutôt que de bloquer la migration.
update public.services
   set margin_mode = 'global', custom_margin = null
 where rate_locked = true and coalesce(provider_rate, 0) = 0;


-- =============================================================
--  4. Application de la marge globale — en une transaction
-- =============================================================

/**
 * Applique une marge à tout le catalogue.
 *
 * Une fonction plutôt qu'une boucle côté serveur : sur plusieurs
 * milliers de services, un envoi par lots peut s'interrompre au milieu
 * et laisser la moitié du catalogue à l'ancienne marge. Ici tout passe
 * dans une seule transaction — ou rien ne passe.
 *
 * `p_reset` décide du sort des marges individuelles :
 *   true  → les exceptions sont effacées, tout le catalogue suit le
 *           global (c'est le sens de « Apply to all »)
 *   false → le global change, les exceptions sont conservées
 */
create or replace function public.apply_global_margin(
  p_margin numeric,
  p_reset  boolean default true,
  p_actor  uuid default null
)
returns table (updated_services int, reset_customs int)
language plpgsql security definer set search_path = public as $$
declare
  v_reset int := 0;
  v_total int := 0;
begin
  if p_margin is null or p_margin < 0 or p_margin > 1000 then
    raise exception 'INVALID_MARGIN';
  end if;

  update public.app_settings
     set global_service_margin = p_margin, updated_by = p_actor
   where id;

  if p_reset then
    -- `rate_locked` est remis à false : la notion de prix figé disparaît
    -- avec l'exception qui la portait.
    update public.services
       set margin_mode = 'global', custom_margin = null, rate_locked = false
     where margin_mode = 'custom';

    get diagnostics v_reset = row_count;
  end if;

  /*
    Recalcul des prix.

    `rate` reste la valeur lue partout — boutique, panier, commandes.
    La marge décide, mais c'est le prix qui est stocké : recalculer à
    chaque affichage coûterait une jointure sur les réglages à chaque
    ligne de catalogue.
  */
  update public.services
     set rate = round(provider_rate * (1 + coalesce(custom_margin, p_margin) / 100), 5)
   where provider_rate is not null;

  get diagnostics v_total = row_count;

  return query select v_total, v_reset;
end;
$$;

revoke all on function public.apply_global_margin(numeric, boolean, uuid)
  from public, anon, authenticated;
grant execute on function public.apply_global_margin(numeric, boolean, uuid) to service_role;


-- =============================================================
--  5. Row Level Security
-- =============================================================
alter table public.app_settings enable row level security;

/*
  Lecture publique.

  Le widget WhatsApp s'affiche pour un visiteur non connecté : sa
  configuration doit lui être lisible. Elle ne contient rien de sensible
  — un état d'activation, un message d'accueil, une position. La marge y
  figure aussi ; c'est une information commerciale, déductible du
  rapport entre coût et prix de toute façon.
*/
drop policy if exists app_settings_public_read on public.app_settings;
create policy app_settings_public_read on public.app_settings
  for select using (true);

-- Aucune politique d'écriture : les réglages ne changent que par les
-- routes d'administration, via la clé de service.


-- =============================================================
--  14. Promotion d'un administrateur
--
--  À exécuter séparément, une seule fois, avec votre adresse.
-- =============================================================
-- update public.profiles set role = 'admin'
-- where id = (select id from auth.users where email = 'smm67official@gmail.com');
