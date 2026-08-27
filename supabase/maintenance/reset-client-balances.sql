-- =============================================================
--  MAINTENANCE — remise à zéro de TOUS les soldes clients
--
--  ⚠️  DESTRUCTIF ET IRRÉVERSIBLE.
--      Aucune sauvegarde n'est faite : les soldes disparaissent.
--
--  ─────────────────────────────────────────────────────────────
--  POURQUOI CE FICHIER N'EST PAS UNE MIGRATION
--
--  Une migration est faite pour être rejouée : `schema-complete.sql`
--  est idempotent et vous l'exécutez à nouveau à chaque évolution du
--  schéma. Une remise à zéro placée dans cette chaîne s'exécuterait
--  DONC À CHAQUE FOIS — y compris après l'ouverture du service, sur des
--  soldes que vos clients auront réellement payés.
--
--  Ce script vit à part pour cette seule raison : il doit être lancé
--  sciemment, une fois, à la main. Le mettre dans 009 aurait fonctionné
--  aujourd'hui et effacé de l'argent réel dans six mois.
--  ─────────────────────────────────────────────────────────────
--
--  À exécuter dans Supabase Studio > SQL Editor, d'un bloc.
--  Le résultat affiche l'état avant et après.
-- =============================================================

begin;

-- -------------------------------------------------------------
-- 1. État avant — à lire avant de valider
-- -------------------------------------------------------------
select
  count(*) filter (where balance <> 0) as comptes_avec_solde,
  coalesce(sum(balance), 0)            as total_avant
from public.profiles;

-- -------------------------------------------------------------
-- 2. Trace de l'opération
--
--    Le détail par compte est figé dans le journal AVANT l'effacement :
--    une fois les soldes à zéro, plus rien ne permettrait de dire ce que
--    chacun détenait. Le journal, lui, n'est jamais purgé.
--
--    Ignoré si la migration 009 n'est pas appliquée — la remise à zéro
--    reste possible, simplement sans trace.
-- -------------------------------------------------------------
do $$
begin
  if to_regclass('public.audit_logs') is not null then
    insert into public.audit_logs (action, target_type, amount, metadata)
    select
      'BALANCE_ADJUSTED',
      'profile',
      coalesce(sum(p.balance), 0),
      jsonb_build_object(
        'operation', 'reset_all_client_balances',
        'accounts', (
          select coalesce(jsonb_agg(jsonb_build_object(
                   'id', x.id, 'username', x.username, 'balance', x.balance)), '[]'::jsonb)
          from public.profiles x
          where x.balance <> 0
        )
      )
    from public.profiles p;
  end if;
end $$;

-- -------------------------------------------------------------
-- 3. Remise à zéro
--
--    `auth.uid()` est NULL dans l'éditeur SQL : le trigger
--    `protect_profile_balance` laisse donc passer cette écriture, comme
--    il laisse passer la clé de service. Un client connecté, lui, ne
--    peut toujours pas toucher son solde.
-- -------------------------------------------------------------
update public.profiles
   set balance = 0, updated_at = now()
 where balance <> 0;

-- -------------------------------------------------------------
-- 4. Grand livre
--
--    Les mouvements passés sont supprimés, et ce n'est pas un détail :
--    la vérification de cohérence compare la somme du grand livre au
--    total des soldes. Les laisser en place ferait apparaître un écart
--    permanent — grand livre à 46, soldes à 0 — qui serait signalé comme
--    une incohérence critique à chaque contrôle.
--
--    Repartir de zéro des deux côtés est le seul état cohérent après une
--    remise à zéro. C'est aussi pour cela que ce script est réservé à
--    une base d'essai : en production, on ne supprime pas un grand livre.
-- -------------------------------------------------------------
delete from public.wallet_transactions;

-- Les demandes de recharge encore ouvertes n'ont plus d'objet : les
-- approuver recréditerait un solde qu'on vient d'effacer.
update public.topup_requests
   set status = 'canceled',
       review_note = coalesce(review_note, 'Annulée : remise à zéro des soldes.')
 where status = 'pending';

-- -------------------------------------------------------------
-- 5. État après — doit afficher 0 partout
-- -------------------------------------------------------------
select
  count(*) filter (where balance <> 0)                        as comptes_avec_solde,
  coalesce(sum(balance), 0)                                   as total_apres,
  (select count(*) from public.wallet_transactions)           as mouvements_restants,
  (select count(*) from public.topup_requests
    where status = 'pending')                                 as recharges_en_attente
from public.profiles;

/*
  Rien n'est écrit tant que vous n'avez pas validé.

  Relisez les deux relevés ci-dessus, puis exécutez :

      commit;

  Pour renoncer :

      rollback;
*/
