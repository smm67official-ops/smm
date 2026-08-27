-- =============================================================
--  Migration 009 — contrôle du solde, blocage des comptes, journal
--
--  Trois sujets, une seule migration car ils partagent le journal
--  d'audit et la notion d'acteur.
--
--  Additive : aucune table existante n'est supprimée, aucune donnée
--  perdue. `wallet_transactions` gagne des colonnes, sa contrainte de
--  type est élargie — les types existants restent valides.
-- =============================================================

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
