-- =============================================================
--  Migration 011 — réglages généraux et marges de service
--
--  Deux sujets, une migration : ils partagent la même table de
--  réglages.
--
--  Additive et rétro-compatible. Les prix déjà fixés à la main sont
--  convertis, pas perdus — voir la section 3.
-- =============================================================

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
