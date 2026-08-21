-- =============================================================
--  Migration 005 — verrouillage du prix de vente
--
--  Sans ce drapeau, la synchronisation du catalogue réécrit
--  `services.rate = provider_rate × (1 + marge)` pour TOUTES les
--  lignes : un prix ajusté à la main était silencieusement perdu
--  au prochain import.
--
--  `rate_locked = true` signale un prix décidé par un administrateur :
--  la synchronisation met alors à jour le coût fournisseur mais laisse
--  le prix de vente intact.
-- =============================================================

alter table public.services
  add column if not exists rate_locked boolean not null default false;

create index if not exists services_rate_locked_idx
  on public.services (rate_locked)
  where rate_locked = true;

comment on column public.services.rate_locked is
  'true = prix de vente fixé manuellement, protégé de la synchronisation.';
