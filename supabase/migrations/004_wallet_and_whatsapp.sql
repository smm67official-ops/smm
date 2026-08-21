-- =============================================================
--  Migration 004 — portefeuille client et finalisation WhatsApp
--  Additive : aucune table existante n'est supprimée ou recréée.
--  `profiles.balance` est conservée comme solde courant ; la nouvelle
--  table sert de grand livre (source de vérité auditable).
-- =============================================================

-- -------------------------------------------------------------
-- 1. Grand livre des mouvements de portefeuille
-- -------------------------------------------------------------
create table if not exists public.wallet_transactions (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid not null references auth.users (id) on delete cascade,
  type           text not null check (type in ('CREDIT', 'DEBIT', 'REFUND', 'ADJUSTMENT')),
  amount         numeric(18, 5) not null check (amount <> 0),
  balance_before numeric(18, 5) not null,
  balance_after  numeric(18, 5) not null check (balance_after >= 0),
  reason         text,
  order_id       uuid references public.orders (id) on delete set null,
  actor_id       uuid references auth.users (id) on delete set null,  -- admin auteur
  created_at     timestamptz not null default now()
);

create index if not exists wallet_tx_user_idx  on public.wallet_transactions (user_id, created_at desc);
create index if not exists wallet_tx_order_idx on public.wallet_transactions (order_id);
create index if not exists wallet_tx_type_idx  on public.wallet_transactions (type);

-- Un débit ne doit jamais être enregistré deux fois pour la même commande.
create unique index if not exists wallet_tx_order_debit_idx
  on public.wallet_transactions (order_id)
  where type = 'DEBIT' and order_id is not null;

-- -------------------------------------------------------------
-- 2. Numéro WhatsApp et traçabilité de l'événement
-- -------------------------------------------------------------
alter table public.orders
  add column if not exists whatsapp text;

alter table public.order_events
  add column if not exists event_type text;

comment on column public.orders.whatsapp is
  'Numéro WhatsApp du client, normalisé en chiffres au format international.';
comment on column public.order_events.event_type is
  'Événement non lié à un changement de statut : WHATSAPP_CLICKED, …';

-- -------------------------------------------------------------
-- 3. Application d'un mouvement — opération atomique
--
--    `for update` verrouille la ligne de profil : deux commandes
--    simultanées du même client sont sérialisées, ce qui rend la
--    double dépense impossible.
-- -------------------------------------------------------------
create or replace function public.wallet_apply(
  p_user_id uuid,
  p_type    text,
  p_amount  numeric,
  p_reason  text default null,
  p_order_id uuid default null,
  p_actor_id uuid default null
)
returns public.wallet_transactions
language plpgsql
security definer
set search_path = public
as $$
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

  select balance into v_before
  from public.profiles
  where id = p_user_id
  for update;

  if not found then
    raise exception 'UNKNOWN_WALLET';
  end if;

  v_after := v_before + v_delta;

  if v_after < 0 then
    raise exception 'INSUFFICIENT_FUNDS';
  end if;

  update public.profiles
     set balance = v_after,
         updated_at = now()
   where id = p_user_id;

  insert into public.wallet_transactions
    (user_id, type, amount, balance_before, balance_after, reason, order_id, actor_id)
  values
    (p_user_id, p_type, v_delta, v_before, v_after, p_reason, p_order_id, p_actor_id)
  returning * into v_row;

  return v_row;
end;
$$;

-- La fonction n'est appelable que par les routes serveur protégées.
revoke all on function public.wallet_apply(uuid, text, numeric, text, uuid, uuid) from public, anon, authenticated;
grant execute on function public.wallet_apply(uuid, text, numeric, text, uuid, uuid) to service_role;

-- -------------------------------------------------------------
-- 4. Row Level Security
-- -------------------------------------------------------------
alter table public.wallet_transactions enable row level security;

-- Lecture seule : son propre historique, ou tout pour un administrateur.
-- Aucune policy d'écriture : le grand livre n'est alimenté que par
-- `wallet_apply` via la clé service_role. Il est donc inaltérable
-- depuis le navigateur, y compris pour un administrateur.
drop policy if exists "own wallet transactions read" on public.wallet_transactions;
create policy "own wallet transactions read" on public.wallet_transactions
  for select using (auth.uid() = user_id or public.is_admin());

-- -------------------------------------------------------------
-- 5. Le solde n'est plus modifiable directement par un client
--
--    `balance` reste dans profiles pour la lecture rapide, mais toute
--    écriture doit passer par le grand livre.
-- -------------------------------------------------------------
create or replace function public.protect_profile_balance()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- `auth.uid() is null` = contexte service_role (wallet_apply, routes
  -- serveur). Un client authentifié ne peut jamais toucher son solde.
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
