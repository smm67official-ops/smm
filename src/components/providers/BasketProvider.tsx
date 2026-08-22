'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { createClient } from '@/lib/supabase/client';

/**
 * Une ligne du panier = une commande SMM à envoyer au fournisseur.
 *
 * `id` identifie la LIGNE, pas le service. Un même service commandé sur
 * deux liens différents donne deux lignes distinctes ; sans identifiant
 * propre, modifier la quantité de l'une modifiait les deux et en
 * supprimer une les supprimait toutes.
 */
export type BasketLine = {
  id: string;
  serviceId: string;
  providerServiceId: number;
  name: string;
  type: string;
  rate: number; // prix de vente pour 1000
  min: number;
  max: number;
  platform: string | null;
  link: string;
  quantity: number;
  extras: Record<string, string | number>;
};

export type FavoriteLine = {
  serviceId: string;
  name: string;
  rate: number;
  platform: string | null;
};

/** Résultat d'un ajout : le formulaire doit savoir s'il a vraiment eu lieu. */
export type AddResult =
  | { ok: true; id: string }
  | { ok: false; reason: 'duplicate'; id: string };

export type FavoriteResult = { ok: boolean; favorited: boolean };

type BasketState = {
  basket: BasketLine[];
  favorites: FavoriteLine[];
  ready: boolean;
  syncing: boolean;
  isAuthenticated: boolean;
  /** Favoris dont l'écriture en base est en cours (état de chargement). */
  pendingFavorites: string[];
  add: (line: Omit<BasketLine, 'id'>) => AddResult;
  update: (lineId: string, patch: Partial<Omit<BasketLine, 'id'>>) => void;
  remove: (lineId: string) => void;
  clear: () => void;
  toggleFavorite: (line: FavoriteLine) => Promise<FavoriteResult>;
  removeFavorite: (serviceId: string) => Promise<FavoriteResult>;
  isFavorite: (serviceId: string) => boolean;
  /** Le service est-il déjà au panier pour ce lien précis ? */
  isInBasket: (serviceId: string, link: string) => boolean;
  count: number;
  total: number;
};

const BASKET_KEY = 'smm.basket';
const FAVORITES_KEY = 'smm.favorites';

/** cost = rate * quantity / 1000 */
export const chargeOf = (line: Pick<BasketLine, 'rate' | 'quantity'>) =>
  (Number(line.rate) * Number(line.quantity)) / 1000;

const BasketContext = createContext<BasketState | null>(null);

const newId = () =>
  typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `l-${Date.now()}-${Math.round(Math.random() * 1e9)}`;

function read<T>(key: string): T[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(key);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? (parsed as T[]) : [];
  } catch {
    return [];
  }
}

/**
 * Paniers enregistrés avant l'introduction de `id` : on leur en attribue
 * un à la lecture, sinon leurs lignes restent inmodifiables.
 */
function migrate(lines: BasketLine[]): BasketLine[] {
  return lines
    .filter((line) => line && line.serviceId)
    .map((line) => (line.id ? line : { ...line, id: newId() }));
}

export function BasketProvider({
  children,
  userId = null,
}: {
  children: ReactNode;
  userId?: string | null;
}) {
  const [basket, setBasket] = useState<BasketLine[]>([]);
  const [favorites, setFavorites] = useState<FavoriteLine[]>([]);
  const [ready, setReady] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [pendingFavorites, setPendingFavorites] = useState<string[]>([]);
  const syncedFor = useRef<string | null>(null);

  // 1. Hydratation locale (visiteur comme utilisateur connecté).
  useEffect(() => {
    setBasket(migrate(read<BasketLine>(BASKET_KEY)));
    setFavorites(read<FavoriteLine>(FAVORITES_KEY));
    setReady(true);
  }, []);

  /*
    2. Session : la base fait autorité pour la wishlist.

    Le compte est mémorisé dans `syncedFor`. Au changement de compte —
    déconnexion puis connexion avec un autre e-mail — les favoris locaux
    du compte précédent sont écartés AVANT toute fusion : sans cela, ils
    étaient poussés dans la wishlist du nouvel arrivant.
  */
  useEffect(() => {
    if (!ready) return;
    if (syncedFor.current === userId) return;

    const previous = syncedFor.current;
    syncedFor.current = userId;

    // Déconnexion, ou bascule vers un autre compte : on repart à zéro.
    if (previous !== null && previous !== userId) {
      window.localStorage.removeItem(FAVORITES_KEY);
      setFavorites([]);
    }

    if (!userId) return;

    const sync = async () => {
      setSyncing(true);
      const supabase = createClient();

      // Fusion des favoris ajoutés en visiteur, uniquement au premier
      // rattachement (aucun compte précédent).
      const local = previous === null ? read<FavoriteLine>(FAVORITES_KEY) : [];
      if (local.length > 0) {
        await supabase
          .from('wishlists')
          .upsert(
            local.map((line) => ({ user_id: userId, service_id: line.serviceId })),
            { onConflict: 'user_id,service_id', ignoreDuplicates: true }
          );
      }

      const { data, error } = await supabase
        .from('wishlists')
        .select('service_id, services ( id, name, rate, platform )')
        .order('created_at', { ascending: false });

      if (!error && data) {
        const rows = data as unknown as Array<{
          service_id: string;
          services: { id: string; name: string; rate: number; platform: string | null } | null;
        }>;

        setFavorites(
          rows
            .filter((row) => row.services)
            .map((row) => ({
              serviceId: row.services!.id,
              name: row.services!.name,
              rate: Number(row.services!.rate),
              platform: row.services!.platform,
            }))
        );
      }

      setSyncing(false);
    };

    void sync();
  }, [ready, userId]);

  // 3. Miroir local : panier toujours, favoris en secours hors ligne.
  useEffect(() => {
    if (ready) window.localStorage.setItem(BASKET_KEY, JSON.stringify(basket));
  }, [basket, ready]);

  useEffect(() => {
    if (ready) window.localStorage.setItem(FAVORITES_KEY, JSON.stringify(favorites));
  }, [favorites, ready]);

  /*
    Ajout au panier.

    Une même commande (service + lien) ne peut pas être empilée deux fois :
    l'API fournisseur refuse « Active order with this link exists ». Le
    refus est RENVOYÉ à l'appelant — auparavant l'ajout était ignoré en
    silence et le formulaire affichait quand même « ajouté au panier ».
  */
  const add = useCallback((line: Omit<BasketLine, 'id'>): AddResult => {
    const existing = basket.find(
      (l) => l.serviceId === line.serviceId && l.link === line.link
    );
    if (existing) return { ok: false, reason: 'duplicate', id: existing.id };

    const id = newId();
    setBasket((prev) => {
      // Contrôle répété dans le setter : deux clics rapprochés passent
      // tous les deux le test ci-dessus avant le premier rendu.
      if (prev.some((l) => l.serviceId === line.serviceId && l.link === line.link)) return prev;
      return [...prev, { ...line, id }];
    });

    return { ok: true, id };
  }, [basket]);

  const update = useCallback((lineId: string, patch: Partial<Omit<BasketLine, 'id'>>) => {
    setBasket((prev) => prev.map((l) => (l.id === lineId ? { ...l, ...patch } : l)));
  }, []);

  const remove = useCallback((lineId: string) => {
    setBasket((prev) => prev.filter((l) => l.id !== lineId));
  }, []);

  const clear = useCallback(() => setBasket([]), []);

  /**
   * Écriture en base d'un favori.
   * Renvoie `false` en cas d'échec : l'appelant doit alors revenir à
   * l'état précédent plutôt que d'afficher un cœur plein mensonger.
   */
  const persistFavorite = useCallback(
    async (serviceId: string, action: 'add' | 'remove'): Promise<boolean> => {
      if (!userId) return true; // visiteur : le stockage local suffit
      const supabase = createClient();

      const { error } =
        action === 'add'
          ? await supabase
              .from('wishlists')
              .upsert(
                { user_id: userId, service_id: serviceId },
                { onConflict: 'user_id,service_id' }
              )
          : await supabase
              .from('wishlists')
              .delete()
              .eq('user_id', userId)
              .eq('service_id', serviceId);

      if (error) console.error('[wishlist]', action, error.message);
      return !error;
    },
    [userId]
  );

  const markPending = useCallback((serviceId: string, on: boolean) => {
    setPendingFavorites((prev) =>
      on ? [...new Set([...prev, serviceId])] : prev.filter((id) => id !== serviceId)
    );
  }, []);

  /**
   * Bascule d'un favori, en mise à jour optimiste.
   * L'interface répond tout de suite ; si la base refuse, l'état est
   * rétabli et l'appelant est informé pour afficher un message.
   */
  const toggleFavorite = useCallback(
    async (line: FavoriteLine): Promise<FavoriteResult> => {
      const wasFavorite = favorites.some((l) => l.serviceId === line.serviceId);
      const next = !wasFavorite;

      markPending(line.serviceId, true);
      setFavorites((prev) =>
        next ? [...prev, line] : prev.filter((l) => l.serviceId !== line.serviceId)
      );

      const ok = await persistFavorite(line.serviceId, next ? 'add' : 'remove');
      markPending(line.serviceId, false);

      if (!ok) {
        setFavorites((prev) =>
          wasFavorite ? [...prev, line] : prev.filter((l) => l.serviceId !== line.serviceId)
        );
        return { ok: false, favorited: wasFavorite };
      }

      return { ok: true, favorited: next };
    },
    [favorites, markPending, persistFavorite]
  );

  const removeFavorite = useCallback(
    async (serviceId: string): Promise<FavoriteResult> => {
      const previous = favorites.find((l) => l.serviceId === serviceId);
      if (!previous) return { ok: true, favorited: false };

      markPending(serviceId, true);
      setFavorites((prev) => prev.filter((l) => l.serviceId !== serviceId));

      const ok = await persistFavorite(serviceId, 'remove');
      markPending(serviceId, false);

      if (!ok) {
        setFavorites((prev) => [...prev, previous]);
        return { ok: false, favorited: true };
      }

      return { ok: true, favorited: false };
    },
    [favorites, markPending, persistFavorite]
  );

  const value = useMemo<BasketState>(
    () => ({
      basket,
      favorites,
      ready,
      syncing,
      isAuthenticated: Boolean(userId),
      pendingFavorites,
      add,
      update,
      remove,
      clear,
      toggleFavorite,
      removeFavorite,
      isFavorite: (serviceId: string) => favorites.some((l) => l.serviceId === serviceId),
      isInBasket: (serviceId: string, link: string) =>
        basket.some((l) => l.serviceId === serviceId && l.link === link),
      count: basket.length,
      total: basket.reduce((sum, l) => sum + chargeOf(l), 0),
    }),
    [
      basket,
      favorites,
      ready,
      syncing,
      userId,
      pendingFavorites,
      add,
      update,
      remove,
      clear,
      toggleFavorite,
      removeFavorite,
    ]
  );

  return <BasketContext.Provider value={value}>{children}</BasketContext.Provider>;
}

export function useBasket() {
  const ctx = useContext(BasketContext);
  if (!ctx) throw new Error('useBasket must be used inside <BasketProvider>');
  return ctx;
}
