-- =============================================================
--  Migration 008 — nom de service modifiable
--
--  Le prix de vente était déjà ajustable et protégé de la
--  synchronisation (migration 005). Le nom, lui, était réécrit à chaque
--  import : un libellé retravaillé pour la boutique — les noms
--  fournisseur sont bruts (« ~ [A] ~ Max 100k ~ 50k/days ~ INSTANT ») —
--  disparaissait à la synchronisation suivante.
--
--  Additive : aucune donnée existante n'est perdue.
-- =============================================================

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
