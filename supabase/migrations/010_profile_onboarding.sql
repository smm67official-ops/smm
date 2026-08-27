-- =============================================================
--  Migration 010 — finalisation du profil après inscription
--
--  Une connexion Google apporte un e-mail, un nom et un avatar — et
--  rien d'autre. Or le panel a besoin du numéro WhatsApp pour joindre
--  le client (commandes, recharges), et connaître ses plateformes
--  d'intérêt permet de lui présenter le bon catalogue d'emblée.
--
--  Ces deux informations sont donc demandées juste après la première
--  connexion, avant d'ouvrir le compte.
--
--  Additive : aucune donnée existante n'est perdue.
-- =============================================================

alter table public.profiles
  -- Chiffres seuls, format international sans « + » : même convention
  -- que `orders.whatsapp`, pour que les deux soient comparables.
  add column if not exists whatsapp     text,

  -- Plateformes déclarées par le client (instagram, tiktok…). Un tableau
  -- plutôt qu'une table de liaison : la liste est courte, figée par le
  -- catalogue, et n'est jamais interrogée autrement que par profil.
  add column if not exists platforms    text[] not null default '{}',

  -- Null = étape non franchie. Le drapeau porte la date, qui répond aussi
  -- à « depuis quand ce compte est-il complet ».
  add column if not exists onboarded_at timestamptz;

comment on column public.profiles.whatsapp is
  'Numéro WhatsApp du client, chiffres au format international.';
comment on column public.profiles.platforms is
  'Plateformes déclarées à l''inscription ; sert à orienter le catalogue.';
comment on column public.profiles.onboarded_at is
  'Date de finalisation du profil. Null = le client doit encore la franchir.';

/*
  Les comptes existants sont considérés finalisés.

  Sans ce rattrapage, tous les clients déjà inscrits seraient renvoyés
  vers un formulaire d'accueil à leur prochaine visite — pour une
  information que beaucoup ont déjà donnée au moment d'une commande.
  L'étape ne concerne donc que les inscriptions à venir.
*/
update public.profiles
   set onboarded_at = coalesce(created_at, now())
 where onboarded_at is null;

/*
  Reprise du numéro déjà connu.

  `orders.whatsapp` contient le numéro saisi lors d'une commande. Le
  recopier évite de le redemander à un client qui l'a déjà fourni.
*/
update public.profiles p
   set whatsapp = o.whatsapp
  from (
    select distinct on (user_id) user_id, whatsapp
      from public.orders
     where user_id is not null and coalesce(whatsapp, '') <> ''
     order by user_id, created_at desc
  ) o
 where o.user_id = p.id and p.whatsapp is null;

create index if not exists profiles_onboarding_idx
  on public.profiles (onboarded_at) where onboarded_at is null;
