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

/** Une ligne du panier = une commande SMM à envoyer au fournisseur. */
export type BasketLine = {
  serviceId: string;
  providerServiceId: number;
  name: string;
  type: string;
  rate: number;      // prix de vente pour 1000
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

type BasketState = {
  basket: BasketLine[];
  favorites: FavoriteLine[];
  ready: boolean;
  syncing: boolean;
  isAuthenticated: boolean;
  add: (line: BasketLine) => void;
  update: (serviceId: string, patch: Partial<BasketLine>) => void;
  remove: (serviceId: string) => void;
  clear: () => void;
  toggleFavorite: (line: FavoriteLine) => void;
  removeFavorite: (serviceId: string) => void;
  isFavorite: (serviceId: string) => boolean;
  count: number;
  total: number;
};

const BASKET_KEY = 'smm.basket';
const FAVORITES_KEY = 'smm.favorites';

/** cost = rate * quantity / 1000 */
export const chargeOf = (line: Pick<BasketLine, 'rate' | 'quantity'>) =>
  (Number(line.rate) * Number(line.quantity)) / 1000;

const BasketContext = createContext<BasketState | null>(null);

function read<T>(key: string): T[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T[]) : [];
  } catch {
    return [];
  }
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
  const mergedFor = useRef<string | null>(null);

  // 1. Hydratation locale (visiteur comme utilisateur connecté).
  useEffect(() => {
    setBasket(read<BasketLine>(BASKET_KEY));
    setFavorites(read<FavoriteLine>(FAVORITES_KEY));
    setReady(true);
  }, []);

  // 2. Utilisateur connecté : la base fait autorité pour la wishlist.
  //    Les favoris ajoutés en visiteur sont fusionnés une seule fois.
  useEffect(() => {
    if (!ready || !userId || mergedFor.current === userId) return;
    mergedFor.current = userId;

    const sync = async () => {
      setSyncing(true);
      const supabase = createClient();

      const local = read<FavoriteLine>(FAVORITES_KEY);
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

  const add = useCallback((line: BasketLine) => {
    // Une même commande (service + lien) ne doit pas être empilée deux fois :
    // l'API fournisseur refuse « Active order with this link exists ».
    setBasket((prev) => {
      const exists = prev.some((l) => l.serviceId === line.serviceId && l.link === line.link);
      return exists ? prev : [...prev, line];
    });
  }, []);

  const update = useCallback((serviceId: string, patch: Partial<BasketLine>) => {
    setBasket((prev) => prev.map((l) => (l.serviceId === serviceId ? { ...l, ...patch } : l)));
  }, []);

  const remove = useCallback((serviceId: string) => {
    setBasket((prev) => prev.filter((l) => l.serviceId !== serviceId));
  }, []);

  const clear = useCallback(() => setBasket([]), []);

  const persistFavorite = useCallback(
    async (serviceId: string, action: 'add' | 'remove') => {
      if (!userId) return;
      const supabase = createClient();

      if (action === 'add') {
        await supabase
          .from('wishlists')
          .upsert({ user_id: userId, service_id: serviceId }, { onConflict: 'user_id,service_id' });
      } else {
        await supabase.from('wishlists').delete().eq('user_id', userId).eq('service_id', serviceId);
      }
    },
    [userId]
  );

  const toggleFavorite = useCallback(
    (line: FavoriteLine) => {
      setFavorites((prev) => {
        const exists = prev.some((l) => l.serviceId === line.serviceId);
        void persistFavorite(line.serviceId, exists ? 'remove' : 'add');
        return exists ? prev.filter((l) => l.serviceId !== line.serviceId) : [...prev, line];
      });
    },
    [persistFavorite]
  );

  const removeFavorite = useCallback(
    (serviceId: string) => {
      void persistFavorite(serviceId, 'remove');
      setFavorites((prev) => prev.filter((l) => l.serviceId !== serviceId));
    },
    [persistFavorite]
  );

  const value = useMemo<BasketState>(
    () => ({
      basket,
      favorites,
      ready,
      syncing,
      isAuthenticated: Boolean(userId),
      add,
      update,
      remove,
      clear,
      toggleFavorite,
      removeFavorite,
      isFavorite: (serviceId: string) => favorites.some((l) => l.serviceId === serviceId),
      count: basket.length,
      total: basket.reduce((sum, l) => sum + chargeOf(l), 0),
    }),
    [basket, favorites, ready, syncing, userId, add, update, remove, clear, toggleFavorite, removeFavorite]
  );

  return <BasketContext.Provider value={value}>{children}</BasketContext.Provider>;
}

export function useBasket() {
  const ctx = useContext(BasketContext);
  if (!ctx) throw new Error('useBasket must be used inside <BasketProvider>');
  return ctx;
}
