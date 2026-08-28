/**
 * Types du schéma (voir supabase/schema.sql).
 * Régénérables avec :
 *   npx supabase gen types typescript --project-id <ref> > src/lib/supabase/types.ts
 */

export type UserRole = 'customer' | 'admin' | 'support';

export type Profile = {
  id: string;
  username: string | null;
  full_name: string | null;
  phone: string | null;
  avatar_url: string | null;
  balance: number;
  role: UserRole;
  is_blocked: boolean;
  blocked_at: string | null;
  blocked_by: string | null;
  block_reason: string | null;
  /** Finalisation du profil (migration 010). */
  whatsapp: string | null;
  platforms: string[];
  onboarded_at: string | null;
  created_at: string;
  updated_at: string;
};

export type Wishlist = {
  id: string;
  user_id: string;
  service_id: string;
  created_at: string;
};

export type WalletTransactionType =
  | 'CREDIT'
  | 'DEBIT'
  | 'REFUND'
  | 'ADJUSTMENT'
  /** Adossés au solde fournisseur (migration 009). */
  | 'BALANCE_ALLOCATION'
  | 'BALANCE_RECLAIM';

export type WalletTransaction = {
  id: string;
  user_id: string;
  type: WalletTransactionType;
  amount: number;
  balance_before: number;
  balance_after: number;
  reason: string | null;
  order_id: string | null;
  actor_id: string | null;
  created_at: string;
  /** Disponible à l'allocation avant / après le mouvement (migration 009). */
  provider_balance_before: number | null;
  provider_balance_after: number | null;
  status: 'SUCCESS' | 'FAILED' | 'PENDING';
  metadata: Record<string, unknown>;
  reference: string | null;
};

/** Relevé du solde fournisseur, réussi ou en échec. */
export type ProviderBalanceSnapshot = {
  id: string;
  provider: string;
  balance: number | null;
  currency: string | null;
  status: 'LIVE' | 'ERROR';
  error: string | null;
  allocated: number | null;
  checked_by: string | null;
  created_at: string;
};

/** Journal des actions sensibles. Ne contient jamais de secret. */
export type AuditLog = {
  id: string;
  action: string;
  actor_id: string | null;
  target_id: string | null;
  target_type: string | null;
  amount: number | null;
  metadata: Record<string, unknown>;
  ip: string | null;
  created_at: string;
};

export type TopUpStatus = 'pending' | 'approved' | 'rejected' | 'canceled';
export type TopUpMethod = 'whatsapp' | 'manual' | 'online';

export type TopUpRequest = {
  id: string;
  user_id: string;
  amount: number;
  bonus: number;
  status: TopUpStatus;
  method: TopUpMethod;
  whatsapp: string | null;
  note: string | null;
  email: string | null;
  reviewed_by: string | null;
  reviewed_at: string | null;
  review_note: string | null;
  transaction_id: string | null;
  created_at: string;
  updated_at: string;
};

/** Ligne de la vue `admin_topup_requests` : demande + identité client. */
export type AdminTopUpRequest = {
  id: string;
  user_id: string;
  amount: number;
  bonus: number;
  status: TopUpStatus;
  method: TopUpMethod;
  whatsapp: string | null;
  note: string | null;
  email: string | null;
  review_note: string | null;
  reviewed_at: string | null;
  created_at: string;
  username: string | null;
  full_name: string | null;
  balance: number;
};

/** Réglages généraux du panel — une seule ligne. */
export type AppSettings = {
  id: boolean;
  global_service_margin: number;
  whatsapp_enabled: boolean;
  whatsapp_message: string | null;
  whatsapp_greeting: string | null;
  whatsapp_position: 'bottom-right' | 'bottom-left';
  updated_at: string;
  updated_by: string | null;
};

/** Numéro WhatsApp professionnel. Un seul porte `is_active` (contrainte en base). */
export type WhatsAppNumber = {
  id: string;
  label: string;
  /** Chiffres seuls, format international sans « + ». */
  number: string;
  note: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

/** Moyen de paiement proposé au client pour recharger son portefeuille. */
export type PaymentMethod = {
  id: string;
  name: string;
  account_number: string | null;
  rib: string | null;
  icon_url: string | null;
  instructions: string | null;
  position: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

export type OrderEvent = {
  id: string;
  order_id: string;
  from_status: string | null;
  to_status: string;
  event_type: string | null;
  source: 'system' | 'admin' | 'provider' | 'whatsapp';
  actor_id: string | null;
  note: string | null;
  created_at: string;
};

export type AdminOrderStats = {
  total_orders: number;
  pending_orders: number;
  processing_orders: number;
  completed_orders: number;
  canceled_orders: number;
  failed_orders: number;
  partial_orders: number;
  total_revenue: number;
  completed_revenue: number;
};

export type ServiceCategory = {
  id: string;
  name: string;
  slug: string;
  platform: string | null;
  position: number;
  created_at: string;
};

export type Service = {
  id: string;
  provider: string;
  provider_service_id: number;
  name: string;
  type: string;
  category_name: string | null;
  category_id: string | null;
  platform: string | null;
  provider_rate: number;
  rate: number;
  min: number;
  max: number;
  refill: boolean;
  cancel: boolean;
  description: string | null;
  is_active: boolean;
  rate_locked: boolean;
  /** Marge individuelle (migration 011). Null = suit la marge globale. */
  margin_mode: 'global' | 'custom';
  custom_margin: number | null;
  /** Libellé d'origine chez le fournisseur, toujours synchronisé. */
  provider_name: string | null;
  /** true = nom réécrit par un administrateur, protégé de la synchronisation. */
  name_locked: boolean;
  synced_at: string;
  created_at: string;
};

export type OrderStatus =
  | 'pending'
  | 'processing'
  | 'in_progress'
  | 'completed'
  | 'partial'
  | 'canceled'
  | 'failed'
  | 'refunded';

export type Order = {
  id: string;
  user_id: string | null;
  status: OrderStatus;
  total: number;
  email: string;
  first_name: string | null;
  last_name: string | null;
  phone: string | null;
  country: string | null;
  note: string | null;
  whatsapp: string | null;
  idempotency_key: string | null;
  provider_error: string | null;
  submitted_at: string | null;
  created_at: string;
  updated_at: string;
};

export type OrderItem = {
  id: string;
  order_id: string;
  service_id: string | null;
  provider_service_id: number | null;
  service_name: string;
  link: string | null;
  quantity: number;
  rate: number;
  charge: number;
  extras: Record<string, unknown>;
  provider_order_id: number | null;
  status: string;
  start_count: number | null;
  remains: number | null;
  provider_error: string | null;
  synced_at: string | null;
  created_at: string;
  updated_at: string;
};

export type PanelStats = {
  users_count: number;
  services_count: number;
  orders_count: number;
};

/**
 * Forme attendue par supabase-js pour chaque table.
 * `R` décrit les clés étrangères : sans elles, les requêtes imbriquées
 * (`select('*, order_items(*)')`) ne sont pas typables.
 */
type Row<T, R extends readonly unknown[] = []> = {
  Row: T;
  Insert: Partial<T>;
  Update: Partial<T>;
  Relationships: R;
};

type FK<Column extends string, Table extends string> = {
  foreignKeyName: string;
  columns: [Column];
  isOneToOne: false;
  referencedRelation: Table;
  referencedColumns: ['id'];
};

export type Database = {
  public: {
    Tables: {
      profiles: Row<Profile>;
      service_categories: Row<ServiceCategory>;
      services: Row<Service, [FK<'category_id', 'service_categories'>]>;
      orders: Row<Order>;
      order_items: Row<OrderItem, [FK<'order_id', 'orders'>, FK<'service_id', 'services'>]>;
      wishlists: Row<Wishlist, [FK<'service_id', 'services'>, FK<'user_id', 'profiles'>]>;
      order_events: Row<OrderEvent, [FK<'order_id', 'orders'>]>;
      wallet_transactions: Row<WalletTransaction, [FK<'order_id', 'orders'>, FK<'user_id', 'profiles'>]>;
      topup_requests: Row<TopUpRequest, [FK<'user_id', 'profiles'>]>;
      provider_balance_snapshots: Row<ProviderBalanceSnapshot>;
      audit_logs: Row<AuditLog>;
      app_settings: Row<AppSettings>;
      whatsapp_numbers: Row<WhatsAppNumber>;
      payment_methods: Row<PaymentMethod>;
      newsletter_subscribers: Row<{ id: string; email: string; created_at: string }>;
      contact_messages: Row<{
        id: string;
        name: string;
        email: string;
        subject: string | null;
        message: string;
        created_at: string;
      }>;
    };
    Views: {
      panel_stats: { Row: PanelStats; Relationships: [] };
      admin_order_stats: { Row: AdminOrderStats; Relationships: [] };
      admin_topup_requests: { Row: AdminTopUpRequest; Relationships: [] };
    };
    Functions: {
      is_admin: { Args: Record<string, never>; Returns: boolean };
      total_allocated_balance: { Args: Record<string, never>; Returns: number };
      allocate_balance: {
        Args: {
          p_user_id: string;
          p_amount: number;
          p_provider_balance: number | null;
          p_actor_id: string;
          p_reason?: string | null;
          p_reference?: string | null;
          p_metadata?: Record<string, unknown>;
        };
        Returns: WalletTransaction;
      };
      reclaim_balance: {
        Args: {
          p_user_id: string;
          p_amount: number;
          p_provider_balance: number | null;
          p_actor_id: string;
          p_reason?: string | null;
          p_reference?: string | null;
          p_metadata?: Record<string, unknown>;
        };
        Returns: WalletTransaction;
      };
      is_blocked: { Args: Record<string, never>; Returns: boolean };
      apply_global_margin: {
        Args: { p_margin: number; p_reset?: boolean; p_actor?: string | null };
        Returns: { updated_services: number; reset_customs: number }[];
      };
      activate_whatsapp_number: {
        Args: { p_id: string };
        Returns: WhatsAppNumber;
      };
      wallet_apply: {
        Args: {
          p_user_id: string;
          p_type: string;
          p_amount: number;
          p_reason?: string | null;
          p_order_id?: string | null;
          p_actor_id?: string | null;
        };
        Returns: WalletTransaction;
      };
    };
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
};
