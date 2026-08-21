# Panel SMM — Next.js + Supabase + API SMMGen

Panel SMM revendeur (achat de followers, likes, vues, abonnés) construit sur le
thème HTML **Surose** ([KaziSadikuzzaman/jewelry-ecommerce](https://github.com/KaziSadikuzzaman/jewelry-ecommerce))
porté en **Next.js 15 (App Router, TypeScript)**, avec **Supabase** en backend et
le catalogue alimenté par l’**API SMMGen** (standard Perfect Panel v2).

Contenu et structure calqués sur `amazingsmm.com/ar`.
L’identité visuelle reste celle du thème : `style.css`, images et Ionicons repris
tels quels, aucune modification du CSS d’origine.

---

## 1. Démarrage

```bash
npm install
cp .env.local.example .env.local   # puis renseigner les variables
npm run dev                        # http://localhost:3000 → /ar
```

Sans `.env.local`, le site reste affichable : le catalogue est vide et un bandeau
le signale sur l’accueil.

## 2. Langues et RTL

Trois langues, préfixe d’URL obligatoire : **`/ar` (défaut), `/fr`, `/en`**.

- `/` redirige vers la langue préférée (cookie `NEXT_LOCALE`, puis
  `Accept-Language`, puis `DEFAULT_LOCALE`).
- L’arabe passe le document en `dir="rtl"` et charge en plus
  `public/assets/css/rtl.css`, qui inverse alignements, flottants et marges du
  thème (Bootstrap 4 n’a pas de build RTL).
- Le sélecteur de langue est dans la barre supérieure ; il pose le cookie et
  redirige vers la même page dans l’autre langue.
- Pour changer la langue par défaut : `DEFAULT_LOCALE` dans
  [src/i18n/config.ts](src/i18n/config.ts).
- Les textes vivent dans [src/i18n/dictionaries/](src/i18n/dictionaries/)
  (`ar.ts`, `fr.ts`, `en.ts`). `en.ts` définit le type : ajouter une clé là
  provoque une erreur TypeScript tant que les deux autres ne l’ont pas.

## 2 bis. Espace d'administration

| Route | Rôle |
|---|---|
| `/{locale}/admin/login` | Connexion réservée aux comptes `role = admin` ou `support` |
| `/{locale}/admin` | Tableau de bord : commandes, revenus, clients, services (filtres jour / 7j / 30j / tout) |
| `/{locale}/admin/orders` | Liste complète : recherche, filtre statut et date, tri, pagination |
| `/{locale}/admin/orders/[id]` | Détail : lignes, cible, identifiants fournisseur, historique, changement de statut |
| `/{locale}/admin/customers` | Clients, nombre de commandes et volume dépensé |
| `/{locale}/admin/services` | Catalogue synchronisé, prix d'achat vs prix de vente |
| `/{locale}/admin/settings` | État de la configuration + références visuelles issues de `DOCS/` |

**Promouvoir un administrateur** (une seule fois, après avoir créé le compte
depuis `/signup`) :

```sql
update public.profiles set role = 'admin'
where id = (select id from auth.users where email = 'votre@email.com');
```

L'autorisation est appliquée à trois niveaux : middleware (redirection),
layout serveur (`requireAdmin`), et RLS PostgreSQL (`public.is_admin()`).
Masquer l'interface ne suffirait pas.

L'admin utilise le design system SocialVault (`/design-system`) ; le site
client conserve le thème d'origine.

## 3. Base de données

Dans **Supabase Studio → SQL Editor**, exécuter dans l'ordre :

1. [supabase/schema.sql](supabase/schema.sql) — socle
2. [supabase/migrations/002_admin_wishlist_orders.sql](supabase/migrations/002_admin_wishlist_orders.sql)
   — rôle admin, wishlist, cycle de vie des commandes (additive, sans perte de données)

Le socle crée :

| Table | Rôle |
|---|---|
| `profiles` | miroir de `auth.users` + solde du portefeuille |
| `service_categories` | catégories fournisseur, avec plateforme déduite |
| `services` | catalogue : prix fournisseur, prix de vente, min, max, refill, cancel |
| `orders` / `order_items` | commandes et lignes (lien, quantité, coût, id fournisseur) |
| `newsletter_subscribers`, `contact_messages` | formulaires publics |
| `panel_stats` (vue) | compteurs affichés sur l’accueil |

La migration 002 ajoute :

| Objet | Rôle |
|---|---|
| `profiles.role` + `public.is_admin()` | autorisation admin, protégée par trigger |
| `wishlists` | wishlist persistante, une ligne par (utilisateur, service) |
| `orders.updated_at` / `idempotency_key` / `provider_error` / `submitted_at` | cycle de vie et anti-doublon |
| `order_items.updated_at` / `provider_error` / `synced_at` | suivi fournisseur par ligne |
| `order_events` | journal des changements de statut (système / admin / fournisseur) |
| `admin_order_stats` (vue) | agrégats admin, accès retiré à `anon` et `authenticated` |

**RLS activée partout.** Catalogue en lecture publique ; chaque utilisateur ne
voit que son profil et ses commandes ; l’écriture du catalogue passe par la clé
`service_role`.

Les compteurs « statistiques en direct » sont les **vrais** comptes de la base :
tant que rien n’est synchronisé ils affichent 0.

### Authentification

Dans **Authentication → URL Configuration**, ajouter à *Redirect URLs* :

```
http://localhost:3000/auth/callback
```

Pour tester sans boîte mail : **Authentication → Providers → Email** →
désactiver *Confirm email*.

## 4. Catalogue SMMGen

### Synchronisation

```bash
curl -X POST http://localhost:3000/api/smm/sync \
  -H "x-sync-secret: $SMM_SYNC_SECRET"
```

La route [src/app/api/smm/sync/route.ts](src/app/api/smm/sync/route.ts) :

1. appelle `action=services` sur l’API SMMGen ;
2. crée les catégories et déduit la plateforme depuis leur libellé
   (`instagram`, `tiktok`, `youtube`… voir [src/lib/platforms.ts](src/lib/platforms.ts)) ;
3. insère les services par lots de 500 avec la marge `SMM_MARKUP_PERCENT`
   (`rate = provider_rate × (1 + marge)`) ;
4. désactive les services absents de la réponse.

À planifier en cron pour suivre les variations de prix.

### Commandes

[src/app/api/smm/order/route.ts](src/app/api/smm/order/route.ts) relit les
services **en base** (le prix n’est jamais envoyé par le navigateur), valide les
champs exigés par le `type` du service, enregistre la commande, puis — seulement
si `SMM_AUTO_SUBMIT=true` — la transmet au fournisseur.

> **Par défaut `SMM_AUTO_SUBMIT=false`.** Un clic ne doit pas dépenser le solde
> réel du panel tant que l’encaissement n’est pas branché. L’API fournisseur n’a
> aucune clé d’idempotence : un double envoi crée deux commandes payantes.

Le client TypeScript de l’API vit dans [src/lib/smmgen.ts](src/lib/smmgen.ts)
(services, add, status, refill, refill_status, cancel, balance + validation par
type de service, d’après `SOURCE/SMMGenAPIReference.md`).

## 5. Arborescence

```
src/
├── app/
│   ├── layout.tsx                 passe-plat (html/body dans [locale])
│   ├── [locale]/
│   │   ├── layout.tsx             html lang/dir, CSS, header, footer
│   │   ├── page.tsx               accueil complète (voir §6)
│   │   ├── services/              catalogue + [id] fiche & formulaire de commande
│   │   ├── cart/                  panier de commandes
│   │   ├── favorites/             services favoris
│   │   ├── checkout/              validation + /success
│   │   ├── account/               tableau de bord, commandes, profil (protégée)
│   │   ├── login/ signup/ forgot-password/
│   │   ├── contact/  api-docs/
│   │   └── not-found.tsx
│   ├── api/smm/sync   import du catalogue fournisseur
│   ├── api/smm/order  enregistrement + envoi des commandes
│   └── auth/callback  échange du code OAuth / confirmation e-mail
├── i18n/                          config, dictionnaires ar/fr/en
├── components/
│   ├── layout/   Header (sélecteur de langue), Footer, Newsletter, ScrollAnim…
│   ├── home/     HeroSlider, StatsBar, PlatformsSwiper, Testimonials, Faq
│   ├── shop/     ServiceFilters, ServiceTable, OrderForm, BasketTable,
│   │             FavoritesTable, CheckoutForm
│   ├── auth/     LoginForm, RegisterForm, ForgotPasswordForm
│   ├── account/  AccountTabs
│   ├── ui/       Breadcrumb, Marquee
│   └── providers/BasketProvider (panier + favoris, localStorage)
└── lib/
    ├── smmgen.ts     client API fournisseur (serveur uniquement)
    ├── platforms.ts  16 plateformes, détection depuis le libellé de catégorie
    ├── queries.ts    lectures serveur du catalogue et des stats
    └── supabase/     client, server, admin (service_role), middleware, types
```

`src/middleware.ts` (dans `src/`, obligatoire quand le projet utilise ce dossier)
gère la redirection de langue **et** le rafraîchissement de session.

## 6. Sections de la page d’accueil

Hero → statistiques en direct → **carrousel des 16 plateformes** (deux bandeaux
en sens opposés) → présentation → 4 étapes → « pourquoi nous » → 8 avantages →
services par plateforme → comparatif → avis clients (carrousel) → moyens de
paiement → FAQ (accordéon) → bandeau de croissance + appel à l’action.

Les carrousels sont du CSS pur ([Marquee](src/components/ui/Marquee.tsx)) :
aucune dépendance Swiper, et l’animation se coupe si
`prefers-reduced-motion` est actif.

## 7. Ce qui remplace jQuery

| Thème d’origine | Remplacement |
|---|---|
| `slick` | `HeroSlider.tsx`, `Testimonials.tsx`, `Marquee.tsx` |
| `meanmenu` | menu accordéon dans `Header.tsx` |
| `ScrollMagic` | `ScrollAnim.tsx` (IntersectionObserver) |
| `nice-select` | `<select className="tm-select">` natif |
| `fancybox`, `bootstrap.js` | état React (onglets, FAQ) |

## 8. Limites connues

- L’endpoint revendeur public `POST /api/v2` (compatible standard marché) est
  **documenté mais pas encore implémenté** ; seule la route interne
  `/api/smm/order` existe.
- Pas de portefeuille débité ni de passerelle de paiement : le choix du moyen de
  paiement au checkout est enregistré comme note.
- Pas de synchronisation de statut des commandes (`action=status` en cron) ni de
  refill/cancel côté interface.
- Panier et favoris sont en `localStorage`, pas en base.

## 9. Scripts

```bash
npm run dev        # développement
npm run build      # build de production
npm start          # serveur de production
npm run typecheck  # tsc --noEmit
```
# Smm
