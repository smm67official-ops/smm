# Cahier des charges — Plateforme SMM white‑label revendeur

**Projet :** conception et mise en service d'un panel SMM (Social Media Marketing) revendeur, avec revente en marque blanche (child panels) et API revendeur
**Référence benchmark :** `https://yoxok.com`
**Commanditaire :** DASHY / DashyPay — contact@dashypay.com
**Date :** 15 août 2026
**Version :** 1.0 (document de cadrage)

---

## Avertissement de lecture

Ce document distingue explicitement trois niveaux d'information :

| Marqueur | Signification |
|---|---|
| **[OBSERVÉ]** | Fait constaté directement sur `yoxok.com` le 15/08/2026, en session connectée |
| **[INFÉRÉ]** | Déduction raisonnable à partir des éléments observés — à confirmer |
| **[À DÉFINIR]** | Décision métier ou technique qui appartient au commanditaire |

Aucun chiffre de coût, de délai ou de performance présenté ici n'est un engagement : ce sont des ordres de grandeur à valider par devis.

---

# PARTIE A — Analyse de l'existant (benchmark YOXOK)

## A.1 Nature de la plateforme

**[OBSERVÉ]** YOXOK est un panel SMM en langue arabe (interface RTL) opérant en dirham marocain (DH / MAD). Il revend des services d'engagement sur réseaux sociaux (followers, likes, vues, commentaires, membres, live viewers…) ainsi que quelques produits numériques (packs PLR).

**[OBSERVÉ]** Les assets du site sont servis depuis `storage.perfectcdn.com`, l'API est exposée sur `/api/v2` et les champs de formulaire suivent la convention `OrderForm[...]`. Ces trois signaux identifient **Perfect Panel** (`perfectpanel.com`), une solution SaaS clé en main pour panels SMM.

**[INFÉRÉ]** YOXOK n'est donc **pas un développement sur mesure** : c'est un locataire d'une plateforme SaaS mutualisée, personnalisée par logo, couleurs, langue, catalogue et moyens de paiement. C'est l'information la plus structurante de tout ce benchmark : elle change radicalement l'arbitrage « acheter vs développer » (voir §C.1).

## A.2 Arborescence fonctionnelle constatée

**[OBSERVÉ]**

| Page | URL | Rôle |
|---|---|---|
| Nouvelle commande | `/` | Tableau de bord + formulaire de commande |
| Commandes | `/orders` | Historique et suivi |
| Ajouter des fonds | `/addfunds` | Rechargement du portefeuille |
| Panel enfant | `/child-panel` | Commande d'un panel en marque blanche |
| Affiliation | `/affiliates` | Programme de parrainage |
| Services | `/services` | Catalogue et tarifs |
| API | `/api` | Documentation API v2 |
| Commande groupée | `/massorder` | Saisie multi‑commandes |
| Compte | `/account` | Profil, sécurité, clé API |
| CGU | `/terms` | Conditions d'utilisation |

## A.3 Catalogue

**[OBSERVÉ]**

- **3 024 services** répartis en **523 catégories**
- Colonnes du catalogue : ID, service, prix / 1 000, quantité min., quantité max., description
- Plateformes couvertes : Instagram (~179 catégories), TikTok (~177), Facebook (~49), YouTube (~35), Telegram (~16), X/Twitter (~17), WhatsApp (~12), plus Snapchat, LinkedIn, Kick, Spotify, Pinterest, Threads, Google Maps, CoinMarketCap, Jaco
- Nomenclature commerciale très codifiée : `[Cheapest]`, `[Non Drop]`, `[Provider]`, `[Refill ♻️]`, `[Emergency 🚨]`, `[S1/S2/S3]`, dates de mise à jour dans le libellé
- Filtres rapides par plateforme (icônes) + moteur de recherche sur le catalogue

## A.4 Formulaire de commande

**[OBSERVÉ]** Le formulaire expose un jeu de champs conditionnels selon le type de service :

`category`, `service`, `link`, `quantity`, `user_name`, `username`, `usernames`, `usernames_custom`, `mentionUsernames`, `comment`, `comment_username`, `keywords`, `hashtag`, `hashtags`, `mediaUrl`, `runs`, `interval`, `total_quantity`, `posts`, `old_posts`, `min`, `max`, `delay`, `expiry`, `answer_number`, `email`, `groups`, `country`, `device`, `type_of_traffic`, `google_keyword`, `referring_url`, `platform`

**[INFÉRÉ]** Cela couvre au minimum les types de commande : Default, Package, Custom Comments, Comment Likes, Mentions (user/hashtag/média), Polls, Subscriptions (auto‑commande sur nouveaux posts), Drip‑feed (`runs` + `interval`), et trafic web ciblé (pays / device / source).

## A.5 Suivi des commandes

**[OBSERVÉ]** Filtres par statut : Tous, En attente, En cours, Terminé, Partiel, En traitement, Annulé.
Colonnes : ID, date, lien, coût, compteur de départ (start count), quantité, service, statut, restant (remains). Recherche disponible.

## A.6 Moyens de paiement — point critique

**[OBSERVÉ]** Cinq méthodes, **toutes manuelles**, sans aucune passerelle automatisée :

| Méthode | Minimum | Circuit |
|---|---|---|
| Virement bancaire marocain (CIH, Barid Bank, RIB pour autres banques) | 100 DH | Virement → capture d'écran → WhatsApp |
| Cash Plus / Wafacash | 100 DH | Dépôt en agence sur un n° de téléphone → reçu → WhatsApp |
| TapTapSend / Sendwave / Remitly / Small World / Botim | 200 DH | Transfert depuis UK, UE, USA, Canada, EAU → capture → WhatsApp |
| Western Union / RIA / MoneyGram | 200 DH | Transfert international nominatif → capture → WhatsApp |
| Binance (Binance ID) | 20 USDT | Transfert crypto → capture → WhatsApp |

**[OBSERVÉ]** Le crédit du compte est déclenché **après vérification humaine** d'une capture d'écran envoyée sur WhatsApp (`+212 777 972 282`). Une table d'historique des paiements existe (ID, date, méthode, montant).

**[INFÉRÉ] Faiblesses de ce modèle :** dépendance à une personne disponible 24/7, latence de crédit, risque de faux justificatifs, absence de réconciliation automatique, absence de reçu/facture, non‑scalabilité, et impossibilité d'exploiter des indicateurs financiers fiables. **C'est le principal gisement de valeur pour un projet porté par un acteur du paiement.**

## A.7 Marque blanche (child panels)

**[OBSERVÉ]** Formulaire de commande d'un panel enfant : nom de domaine (avec redirection des nameservers vers `dns1.cloudns.net` / `dns2.cloudns.net`), devise parmi ~69 devises, identifiant admin, mot de passe + confirmation, prix mensuel, envoi de la demande.

**[INFÉRÉ]** Le revendeur enfant hérite du catalogue du panel parent, applique sa propre marge, et paie un abonnement mensuel au panel parent.

## A.8 Affiliation

**[OBSERVÉ]** Lien de parrainage `/ref/{code}`, commission **8 %**, seuil de retrait **10 DH**. Statistiques : visites, inscriptions, filleuls, taux de conversion, gains totaux, gains disponibles. Table d'historique des retraits.

## A.9 API revendeur

**[OBSERVÉ]** API HTTP POST sur `/api/v2`, réponses JSON, authentification par clé API générée depuis `/account`. Actions : `services`, `add` (Default / Package / Custom Comments / Comment Likes / Subscriptions, avec `runs` et `interval` optionnels), `status`, statut multiple (jusqu'à 100 IDs), `refill`, refill multiple, `refill_status`, `cancel`, `balance`. Exemple de code PHP fourni.

**[INFÉRÉ]** C'est le standard de facto du marché SMM : toute nouvelle plateforme doit exposer une API **strictement compatible** pour être adoptée par les revendeurs existants.

## A.10 Compte et sécurité

**[OBSERVÉ]** Nom d'utilisateur, e‑mail (modifiable), langue (English / العربية), fuseau horaire, changement de mot de passe, **2FA par e‑mail**, génération de clé API, onglet notifications.

**[INFÉRÉ]** Pas de 2FA TOTP (application d'authentification) constatée — faiblesse à corriger sur une plateforme qui détient des soldes.

## A.11 Support

**[OBSERVÉ]** Bouton flottant WhatsApp et bouton Telegram (canal `@yoxokupdate`). **Aucun système de tickets n'a été observé** dans la navigation.

## A.12 Ce qui n'a pas pu être vérifié

Session ouverte sur un compte connecté : la page d'accueil publique, le tunnel d'inscription, les pages FAQ / à propos / contact, le back‑office administrateur, les intégrations fournisseurs et les performances réelles **n'ont pas été observés**. Aucune commande ni aucun paiement n'a été effectué.

---

# PARTIE B — Cahier des charges du projet

## B.1 Contexte et enjeu

Le marché des panels SMM au Maroc et en Afrique francophone/arabophone est mature côté catalogue mais **immature côté encaissement**. Les acteurs comme YOXOK opèrent avec un rechargement manuel validé sur WhatsApp. Un acteur maîtrisant la chaîne de paiement dispose donc d'un avantage différenciant direct : crédit instantané, réconciliation automatique, facturation, et capacité à ouvrir la plateforme à des revendeurs qui ne peuvent pas gérer un support manuel permanent.

## B.2 Objectifs

| # | Objectif | Indicateur de succès **[À DÉFINIR]** |
|---|---|---|
| O1 | Lancer un panel SMM revendeur opérationnel | Mise en production V1 |
| O2 | Automatiser 100 % du rechargement de portefeuille | % de dépôts crédités sans intervention humaine |
| O3 | Permettre la revente en marque blanche | Nombre de child panels actifs |
| O4 | Exposer une API compatible avec le standard du marché | Nombre de revendeurs intégrés par API |
| O5 | Assurer la traçabilité comptable et fiscale | Facture automatique sur chaque dépôt |

## B.3 Périmètre

**Inclus :** site public, espace client, catalogue et moteur de commande, portefeuille et paiements automatisés, suivi de commandes, refill/cancel, drip‑feed, subscriptions, commande groupée, affiliation, child panels, API v2, back‑office admin, intégration fournisseurs, support/tickets, notifications, multilingue FR/AR/EN avec RTL.

**Exclu (sauf décision contraire) :** production interne des services d'engagement (la plateforme est **revendeur** et s'approvisionne auprès de fournisseurs via API), application mobile native, marketplace de produits numériques.

## B.4 Acteurs et rôles

| Acteur | Description | Droits principaux |
|---|---|---|
| Visiteur | Non authentifié | Consulter le site public, le catalogue public, s'inscrire |
| Client | Compte particulier | Commander, recharger, suivre, demander refill/annulation, ouvrir un ticket |
| Revendeur API | Client avec clé API | Tout le rôle Client + accès programmatique |
| Revendeur child panel | Exploite un panel en marque blanche | Sous‑catalogue, ses propres tarifs, ses propres clients |
| Support | Agent | Tickets, consultation commandes, remboursement partiel encadré |
| Administrateur | Exploitant | Catalogue, marges, fournisseurs, utilisateurs, finance, paramètres |
| Fournisseur | Système externe | Réception de commandes via API, remontée de statuts |

## B.5 Exigences fonctionnelles

### B.5.1 Site public et acquisition

- Page d'accueil avec proposition de valeur, catalogue public consultable sans compte, tarifs, FAQ, CGU/CGV, politique de confidentialité, page contact
- Inscription : e‑mail + mot de passe, **vérification e‑mail obligatoire**, acceptation CGU horodatée
- Connexion, mot de passe oublié, protection anti‑bot sur les formulaires publics
- SEO technique : URLs propres, sitemap, balises hreflang FR/AR/EN, Open Graph

### B.5.2 Catalogue

- Hiérarchie catégorie → service ; recherche plein texte ; filtres par plateforme, prix, disponibilité
- Fiche service : ID, libellé, prix / 1 000, min, max, description structurée (délai de démarrage estimé, vitesse, garantie refill, taux de chute attendu, avertissements)
- **Import automatique** du catalogue fournisseur via API, avec règles de marge (marge par catégorie, par service, ou globale, en % ou montant fixe)
- Synchronisation planifiée des prix et des disponibilités, avec **journal des variations** et alerte si un prix fournisseur augmente au‑delà d'un seuil
- Activation/désactivation service par service ; masquage des services fournisseurs indisponibles

### B.5.3 Commande

- Types supportés : **Default**, **Package**, **Custom Comments**, **Comment Likes**, **Mentions** (utilisateur / hashtag / média / liste custom), **Poll**, **Subscriptions**, **Drip‑feed**, **Trafic ciblé** (pays / device / source)
- Champs conditionnels selon le type, alignés sur le standard observé (§A.4)
- Validation du lien selon la plateforme cible (format d'URL) avant soumission
- Calcul du coût en temps réel ; blocage si solde insuffisant, avec renvoi vers le rechargement
- Contrôle anti‑doublon : alerte si une commande identique (même lien + même service) est en cours
- **Commande groupée** : une commande par ligne, format `service_id | lien | quantité`, avec prévisualisation du coût total et rapport d'erreurs ligne par ligne avant validation
- Panier de services favoris **[À DÉFINIR]**

### B.5.4 Cycle de vie et statuts

Statuts normalisés : `Pending`, `Processing`, `In progress`, `Completed`, `Partial`, `Canceled`, `Refunded`.

- Enregistrement du **start count** au démarrage
- Champ `remains` mis à jour par synchronisation fournisseur
- **Partial** : remboursement automatique au prorata sur le portefeuille
- **Canceled** : remboursement intégral automatique
- **Refill** : bouton disponible si le service est éligible, avec fenêtre de garantie (ex. 30 jours) et suivi du statut de refill
- Historique complet horodaté de chaque changement d'état

### B.5.5 Portefeuille et paiements — cœur du projet

**Principe : aucun crédit manuel par défaut.** Toute méthode retenue doit produire une confirmation machine.

| Canal | Automatisation attendue | Statut |
|---|---|---|
| Carte bancaire marocaine (CMI ou Payzone) | Webhook → crédit instantané | **[À DÉFINIR]** priorité 1 |
| Portefeuille mobile / paiement de proximité (CashPlus, Wafacash, Barid) | API partenaire → crédit automatique | **[À DÉFINIR]** priorité 2 |
| Virement bancaire | Rapprochement automatique par référence unique de virement | Semi‑automatique |
| Crypto (USDT TRC20 / BEP20) | Adresse dédiée par utilisateur + confirmations on‑chain → crédit automatique | Priorité 2 |
| Carte internationale (Stripe / PayPal) | Selon éligibilité de l'entité juridique | **[À DÉFINIR]** |
| Recharge manuelle admin | Réservée aux corrections, avec motif obligatoire et journal | Exception |

Exigences transverses :

- Montant minimum et maximum de dépôt paramétrables par méthode
- **Référence de paiement unique** générée par transaction, obligatoire pour tout rapprochement
- Idempotence des webhooks : un même événement ne peut créditer deux fois
- Journal d'audit inaltérable de tout mouvement de solde (dépôt, débit commande, remboursement, ajustement admin)
- Génération automatique d'une facture/reçu PDF par dépôt, conforme aux mentions légales marocaines **[À DÉFINIR avec un expert‑comptable]**
- Détection de fraude : plafonds par période, alerte sur dépôts multiples de petits montants, blocage de compte sur anomalie
- Export comptable (CSV / format attendu par le comptable)
- Bonus de recharge paramétrables (ex. +5 % au‑delà de X DH) **[À DÉFINIR]**

### B.5.6 Affiliation

- Lien `/ref/{code}` avec attribution par cookie (durée **[À DÉFINIR]**, ex. 30 jours)
- Commission en % du montant dépensé par le filleul, paramétrable globalement et par affilié
- Seuil minimum de retrait ; retrait vers le solde du panel ou vers un moyen de paiement externe
- Tableau de bord : visites, inscriptions, filleuls actifs, taux de conversion, gains totaux / disponibles / versés
- Anti‑abus : blocage de l'auto‑parrainage, détection multi‑comptes (IP / empreinte / moyen de paiement)

### B.5.7 Child panels (marque blanche)

- Commande d'un panel enfant depuis l'espace client : domaine, devise, identifiants admin, formule d'abonnement
- Provisionnement : sous‑domaine immédiat ou domaine propre du revendeur (instructions DNS + certificat TLS automatique)
- Personnalisation : logo, couleurs, nom, langue par défaut, CGU propres
- Le revendeur enfant définit ses propres prix par‑dessus le prix parent ; ses commandes débitent le solde parent
- Facturation récurrente de l'abonnement, avec suspension automatique en cas d'impayé
- Isolation stricte des données entre panels enfants

### B.5.8 API revendeur

- **Contrainte forte : compatibilité stricte avec l'API v2 du marché** (§A.9), pour permettre une migration sans réécriture côté revendeur
- Endpoint `POST /api/v2`, JSON, authentification par clé
- Actions : `services`, `add`, `status`, `status` multiple (≤ 100), `refill`, `refill` multiple, `refill_status`, `cancel`, `balance`
- Ajouts recommandés au‑delà du standard : rotation de clé, restriction par IP, quotas et rate‑limiting par clé, webhooks sortants de changement de statut, documentation OpenAPI et exemples PHP / Python / Node.js

### B.5.9 Support et notifications

- Système de **tickets interne** (catégorie, pièce jointe, historique, SLA affiché) — corrige l'absence constatée chez le benchmark
- Canaux complémentaires : WhatsApp Business API, canal Telegram d'annonces
- Notifications e‑mail et in‑app : commande terminée, commande partielle/annulée, dépôt crédité, solde bas, réponse à un ticket, alerte sécurité (nouvelle connexion)
- Bandeau d'annonces global piloté par l'admin

### B.5.10 Back‑office administrateur

- **Tableau de bord** : chiffre d'affaires, marge brute, dépôts, commandes par statut, taux d'échec fournisseur, top services
- **Utilisateurs** : recherche, solde, historique, blocage, ajustement de solde motivé, connexion « en tant que » tracée
- **Commandes** : recherche, forçage de statut, relance fournisseur, remboursement
- **Catalogue** : marges, activation, réordonnancement, libellés multilingues, descriptions
- **Fournisseurs** : ajout de fournisseurs API, mapping service local ↔ service fournisseur, bascule automatique vers un fournisseur de secours si le principal échoue
- **Finance** : transactions, rapprochements, exports, factures
- **Paramètres** : devises et taux, langues, méthodes de paiement, CGU, SEO, thème
- **Journal d'audit** de toute action administrateur

## B.6 Exigences non fonctionnelles

| Domaine | Exigence |
|---|---|
| Sécurité | Chiffrement TLS ; mots de passe hachés (bcrypt/argon2) ; **2FA TOTP** en plus de l'e‑mail ; protection OWASP Top 10 ; rate‑limiting sur connexion et API ; secrets hors dépôt de code ; clés API révocables |
| Données personnelles | Conformité **loi 09‑08** (Maroc) et RGPD si clients UE : registre de traitement, durée de conservation, droit d'accès/suppression, mentions légales, consentement cookies |
| Disponibilité | Cible **[À DÉFINIR]**, ordre de grandeur 99,5 % ; supervision et alerting ; sauvegardes quotidiennes chiffrées avec test de restauration |
| Performance | Catalogue de 3 000+ services paginé/virtualisé ; recherche indexée ; traitement asynchrone des envois fournisseurs par file de messages |
| Scalabilité | Architecture permettant de passer de quelques centaines à plusieurs dizaines de milliers de commandes/jour sans réécriture |
| Internationalisation | FR / AR / EN dès la V1, **support RTL complet** ; multi‑devises avec taux paramétrables |
| Accessibilité | Contrastes conformes WCAG 2.1 AA, navigation clavier, libellés de formulaires |
| Mobile | Responsive obligatoire ; le trafic de ce marché est majoritairement mobile **[INFÉRÉ]** |
| Traçabilité | Toute opération financière et tout changement de statut horodatés et non modifiables |

## B.7 Architecture technique proposée **[À DÉFINIR — proposition]**

- **Front** : application web responsive (rendu serveur pour le SEO du site public)
- **Back** : API REST + files d'attente pour les appels fournisseurs et les webhooks de paiement
- **Base de données** relationnelle (soldes et commandes exigent des transactions ACID) + cache
- **Workers** : envoi des commandes, synchronisation des statuts, synchronisation des prix, relances, notifications
- **Multi‑tenant** natif pour les child panels (identifiant de tenant sur chaque entité)
- **Environnements** : développement, recette, production ; déploiement automatisé ; journalisation centralisée

### Entités principales du modèle de données

`User`, `Tenant/Panel`, `Category`, `Service`, `Provider`, `ProviderService`, `Order`, `OrderEvent`, `Refill`, `Transaction`, `Deposit`, `PaymentMethod`, `Invoice`, `AffiliateLink`, `AffiliateCommission`, `Payout`, `Ticket`, `TicketMessage`, `ApiKey`, `AuditLog`, `Setting`.

## B.8 Lotissement proposé **[À DÉFINIR — estimations, non contractuelles]**

| Lot | Contenu | Ordre de grandeur |
|---|---|---|
| **L0 — Cadrage** | Spécifications détaillées, maquettes, choix des fournisseurs et de la passerelle | 2–3 semaines |
| **L1 — MVP** | Inscription/connexion, catalogue, commande Default + Drip‑feed, portefeuille, **1 passerelle automatisée**, suivi de commandes, 1 fournisseur API, back‑office minimal | 6–10 semaines |
| **L2 — Standard marché** | API v2 complète, refill/cancel, commande groupée, types de commande avancés, tickets, notifications, multi‑fournisseurs avec bascule | 4–6 semaines |
| **L3 — Croissance** | Affiliation, child panels multi‑tenant, multi‑devises, facturation automatique, tableau de bord analytique | 5–8 semaines |
| **L4 — Industrialisation** | Anti‑fraude, exports comptables, 2FA TOTP, audit sécurité externe, optimisation performance | 3–4 semaines |

## B.9 Arbitrage « acheter vs développer » **[INFÉRÉ — à trancher]**

| Critère | Solution SaaS type Perfect Panel | Développement sur mesure |
|---|---|---|
| Délai de mise en service | Jours | Plusieurs mois |
| Coût d'entrée | Abonnement mensuel — grille publique annoncée à partir de **50 $/mois**, croissant avec le volume de commandes | Investissement initial élevé |
| Moyens de paiement | Limités à ce que l'éditeur intègre | **Totale liberté — l'avantage décisif ici** |
| Propriété | Aucune | Totale |
| Différenciation | Faible (interfaces identiques entre concurrents) | Forte |
| Dépendance | Éditeur unique | Équipe technique |

**Recommandation à valider :** pour un acteur du paiement, l'intérêt du projet réside précisément dans la couche que le SaaS ne permet pas de maîtriser. Une voie intermédiaire existe : démarrer sur un SaaS pour valider le marché et l'approvisionnement fournisseurs, tout en développant en parallèle la brique paiement propriétaire. **[À DÉFINIR]**

## B.10 Recette et critères d'acceptation

- Jeu de tests fonctionnels couvrant chaque type de commande et chaque statut
- Test de bout en bout paiement : dépôt réel de faible montant → webhook → crédit → commande → débit → remboursement partiel
- Test d'idempotence : rejeu d'un webhook ne crédite pas deux fois
- Test de charge sur le catalogue et sur l'API
- Test de compatibilité API : un script revendeur écrit pour l'API v2 standard fonctionne sans modification
- Test RTL sur l'ensemble des écrans en arabe
- Audit de sécurité (a minima OWASP Top 10) avant mise en production
- Vérification du parcours mobile complet

## B.11 Risques et points de vigilance

| Risque | Niveau **[INFÉRÉ]** | Traitement |
|---|---|---|
| Refus d'agrément par la passerelle de paiement (secteur jugé sensible) | **Élevé** | Valider l'éligibilité du secteur **avant** tout développement ; prévoir plusieurs canaux |
| Conformité aux CGU des réseaux sociaux : ces services violent généralement les conditions d'utilisation des plateformes | **Élevé** | Cadrage juridique préalable ; CGU claires ; absence de garantie de résultat |
| Rétrofacturations (chargebacks) sur un service non remboursable | Moyen | Preuve de livraison, CGU explicites, plafonds, KYC au‑delà d'un seuil |
| Dépendance à un fournisseur unique | Moyen | Multi‑fournisseurs avec bascule automatique |
| Volatilité des prix fournisseurs érodant la marge | Moyen | Synchronisation automatique + alertes de seuil |
| Fraude et multi‑comptes sur l'affiliation | Moyen | Détection d'empreintes, validation manuelle des retraits |
| Qualité de service (drops, commandes bloquées) | Moyen | Refill automatisé, remboursement au prorata, indicateurs par fournisseur |

## B.12 Livrables attendus du prestataire

1. Spécifications fonctionnelles détaillées et maquettes validées
2. Code source complet + dépôt Git remis au commanditaire
3. Documentation technique (architecture, déploiement, variables d'environnement)
4. Documentation API publique (OpenAPI + exemples de code)
5. Manuel administrateur
6. Jeux de tests et rapport de recette
7. Rapport d'audit de sécurité
8. Transfert de compétences + période de garantie **[À DÉFINIR]**

---

## Annexe 1 — Matrice de comparaison avec le benchmark

| Fonctionnalité | YOXOK **[OBSERVÉ]** | Projet cible |
|---|---|---|
| Catalogue multi‑plateformes | Oui (3 024 services) | Oui, avec import fournisseur automatisé |
| Types de commande avancés | Oui | Oui |
| Commande groupée | Oui | Oui, avec prévisualisation et rapport d'erreurs |
| Suivi de commandes | Oui | Oui, avec historique d'événements |
| Refill / Cancel | Via API | Oui, également en interface |
| **Paiement automatisé** | **Non — 100 % manuel** | **Oui — priorité n°1** |
| Facturation | Non observée | Oui, automatique |
| Affiliation | Oui (8 %, seuil 10 DH) | Oui, paramétrable + anti‑fraude |
| Child panels | Oui | Oui, multi‑tenant natif |
| API revendeur v2 | Oui | Oui, compatible + webhooks |
| Tickets support | Non observé | Oui |
| 2FA | E‑mail uniquement | E‑mail + TOTP |
| Langues | AR / EN | FR / AR / EN |
| Journal d'audit | Non observable | Oui |

## Annexe 2 — Glossaire

- **Panel SMM** : plateforme de revente de services d'engagement sur réseaux sociaux
- **Child panel** : panel en marque blanche adossé au catalogue d'un panel parent
- **Drip‑feed** : livraison fractionnée d'une commande en plusieurs passages espacés
- **Refill** : recomplètement gratuit d'une commande ayant subi une baisse (drop)
- **Drop** : perte d'une partie des followers/likes livrés après la commande
- **Start count** : compteur relevé avant démarrage, servant de référence de livraison
- **Provider / fournisseur** : source réelle du service, consommée via API
- **PLR / MRR** : licences de revente de produits numériques

---

*Document de cadrage — à compléter par les décisions marquées **[À DÉFINIR]** avant consultation de prestataires.*
