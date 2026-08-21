-- =========================================================
-- 006 — Demandes de recharge de portefeuille
--
-- Le panel n'a pas de prestataire de paiement branché : une recharge
-- est confirmée à la main. Sans trace en base, le client cliquait sur
-- « recharger » et l'information n'existait que dans une conversation
-- WhatsApp. Cette table donne un état vérifiable des deux côtés :
-- le client suit sa demande, l'administration a une file d'attente.
--
-- Le crédit lui-même reste le monopole de `wallet_apply` : approuver
-- une demande appelle cette fonction, jamais un UPDATE sur `profiles`.
-- =========================================================

create table if not exists public.topup_requests (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid not null references auth.users (id) on delete cascade,

  -- Montant demandé, dans la devise du panel. Même précision que le
  -- grand livre : une demande doit pouvoir être créditée à l'identique.
  amount         numeric(18, 5) not null check (amount > 0),

  -- Bonus promotionnel, calculé côté serveur au dépôt de la demande.
  -- Figé à cet instant : une évolution du barème ne doit pas changer
  -- ce qui a été promis à un client dont la demande est déjà en file.
  bonus          numeric(18, 5) not null default 0 check (bonus >= 0),

  status         text not null default 'pending'
                   check (status in ('pending', 'approved', 'rejected', 'canceled')),

  -- Canal choisi par le client. `whatsapp` aujourd'hui ; la colonne
  -- existe pour qu'un futur paiement en ligne n'impose pas de migration.
  method         text not null default 'whatsapp'
                   check (method in ('whatsapp', 'manual', 'online')),

  whatsapp       text,
  note           text,

  -- Instantané de l'adresse au moment de la demande. Le reste du schéma
  -- n'interroge jamais `auth.users` en SQL ; on garde cette règle, et
  -- l'administration dispose quand même d'un identifiant lisible.
  email          text,

  -- Traçabilité de la décision.
  reviewed_by    uuid references auth.users (id) on delete set null,
  reviewed_at    timestamptz,
  review_note    text,
  transaction_id uuid references public.wallet_transactions (id) on delete set null,

  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

create index if not exists topup_requests_user_idx
  on public.topup_requests (user_id, created_at desc);

-- La file d'attente de l'administration ne lit que les demandes ouvertes.
create index if not exists topup_requests_pending_idx
  on public.topup_requests (created_at desc)
  where status = 'pending';

drop trigger if exists topup_requests_touch_updated_at on public.topup_requests;
create trigger topup_requests_touch_updated_at
  before update on public.topup_requests
  for each row execute function public.touch_updated_at();

-- ---------------------------------------------------------
-- RLS
-- ---------------------------------------------------------
alter table public.topup_requests enable row level security;

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

-- ---------------------------------------------------------
-- Garde-fou : le statut ne peut pas passer de `approved` à autre chose.
-- Une demande approuvée a déjà crédité un portefeuille ; la rouvrir
-- permettrait un double crédit.
-- ---------------------------------------------------------
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

-- ---------------------------------------------------------
-- Vue d'administration : demande + identité du client.
-- ---------------------------------------------------------
drop view if exists public.admin_topup_requests;
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
