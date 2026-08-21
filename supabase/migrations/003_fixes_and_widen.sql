-- =============================================================
--  Migration 003 — deux correctifs constatés en conditions réelles
--  Additive, aucune perte de données.
-- =============================================================

-- -------------------------------------------------------------
-- 1. Promotion d'un administrateur
--
--    La 002 bloquait TOUTE modification du rôle dès que `auth.uid()`
--    était NULL — c'est-à-dire depuis la clé service_role et depuis
--    l'éditeur SQL. Promouvoir un admin devenait impossible.
--
--    Règle corrigée : changement autorisé pour un admin connecté OU
--    dans un contexte sans JWT (service_role / SQL editor), déjà de
--    confiance. Un client authentifié reste incapable de s'auto-promouvoir.
-- -------------------------------------------------------------
create or replace function public.protect_profile_role()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.role is distinct from old.role
     and auth.uid() is not null
     and not public.is_admin() then
    raise exception 'role can only be changed by an administrator';
  end if;
  return new;
end;
$$;

-- -------------------------------------------------------------
-- 2. Élargissement des colonnes monétaires
--
--    Le catalogue SMMGen contient des tarifs jusqu'à ~96 000 000 par
--    millier. numeric(12,5) ne tolère que 7 chiffres avant la virgule
--    et provoquait « numeric field overflow » à la synchronisation.
--
--    PostgreSQL refuse de changer le type d'une colonne utilisée par
--    une vue : les deux vues sont donc supprimées puis recréées à
--    l'identique. Elles ne contiennent aucune donnée propre.
-- -------------------------------------------------------------
drop view if exists public.admin_order_stats;
drop view if exists public.panel_stats;

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

-- -------------------------------------------------------------
-- 3. Recréation des vues
-- -------------------------------------------------------------
create view public.panel_stats as
select
  (select count(*) from public.profiles)                 as users_count,
  (select count(*) from public.services where is_active) as services_count,
  (select count(*) from public.order_items)              as orders_count;

create view public.admin_order_stats as
select
  count(*)                                                       as total_orders,
  count(*) filter (where status = 'pending')                     as pending_orders,
  count(*) filter (where status in ('processing', 'in_progress')) as processing_orders,
  count(*) filter (where status = 'completed')                   as completed_orders,
  count(*) filter (where status = 'canceled')                    as canceled_orders,
  count(*) filter (where status = 'failed')                      as failed_orders,
  count(*) filter (where status = 'partial')                     as partial_orders,
  coalesce(sum(total), 0)                                        as total_revenue,
  coalesce(sum(total) filter (where status = 'completed'), 0)    as completed_revenue
from public.orders;

-- Une vue ne porte pas de RLS : l'accès aux agrégats d'administration
-- est retiré aux rôles publics. `panel_stats` reste public (accueil).
revoke all on public.admin_order_stats from anon, authenticated;
