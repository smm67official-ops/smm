-- =============================================================
--  Migration 007 — paramètres : numéros WhatsApp et moyens de paiement
--
--  Le numéro WhatsApp vivait dans une variable d'environnement
--  (`NEXT_PUBLIC_WHATSAPP_BUSINESS_NUMBER`), donc figé au moment du
--  build : le changer imposait un redéploiement. Les moyens de paiement,
--  eux, n'existaient nulle part — ils se transmettaient de vive voix.
--
--  Les deux passent en base, administrables depuis le back-office.
--  Additive : aucune table existante n'est touchée.
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
