-- =============================================================
--  Migration 012 — l'envoi automatique des commandes passe en base
--
--  `SMM_AUTO_SUBMIT` vivait dans les variables d'environnement, donc
--  figée au build : basculer l'envoi imposait un redéploiement, et rien
--  dans le back-office n'indiquait son état. C'est pourtant l'interrupteur
--  le plus lourd de conséquence du panel — il décide si une commande
--  part réellement chez le fournisseur, et donc si l'argent quitte le
--  compte SMMGen.
--
--  Additive. Le repli applicatif conserve l'ancien comportement tant que
--  cette migration n'est pas appliquée.
-- =============================================================

alter table public.app_settings
  /*
    `false` par défaut, et ce n'est pas un détail.

    Une valeur par défaut à `true` transmettrait les commandes dès la
    migration appliquée, sans que personne l'ait demandé. Pour un
    réglage qui engage de l'argent réel, le défaut doit être l'inaction.
  */
  add column if not exists auto_submit_orders boolean not null default false;

comment on column public.app_settings.auto_submit_orders is
  'true = les commandes partent chez le fournisseur dès leur création. '
  'false = elles sont enregistrées et débitées, mais jamais transmises.';

/*
  Reprise de la valeur en vigueur.

  La colonne vient d'être créée à `false` ; si l'envoi était activé par
  la variable d'environnement, l'appliquer ici évite une interruption
  silencieuse du service au moment de la migration.

  À exécuter à la main si `SMM_AUTO_SUBMIT` valait `true` :

      update public.app_settings set auto_submit_orders = true where id;
*/
