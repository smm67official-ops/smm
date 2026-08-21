import type { OrderStatus } from '@/lib/supabase/types';

/** Statuts internes, alignés sur le cycle de vie décrit dans le cahier des charges. */
export const ORDER_STATUSES: OrderStatus[] = [
  'pending',
  'processing',
  'in_progress',
  'completed',
  'partial',
  'canceled',
  'failed',
  'refunded',
];

export const STATUS_LABEL: Record<OrderStatus, string> = {
  pending: 'Pending',
  processing: 'Processing',
  in_progress: 'In progress',
  completed: 'Completed',
  partial: 'Partial',
  canceled: 'Canceled',
  failed: 'Failed',
  refunded: 'Refunded',
};

export const STATUS_TONE: Record<OrderStatus, 'neutral' | 'info' | 'success' | 'warning' | 'error'> = {
  pending: 'warning',
  processing: 'info',
  in_progress: 'info',
  completed: 'success',
  partial: 'warning',
  canceled: 'neutral',
  failed: 'error',
  refunded: 'neutral',
};

/**
 * Correspondance statut fournisseur → statut interne.
 * L'API v2 renvoie un texte libre : on ne doit jamais échouer sur une
 * valeur inconnue (SMMGenAPIReference.md §5).
 */
export function mapProviderStatus(raw?: string | null): OrderStatus | null {
  if (!raw) return null;

  switch (raw.trim().toLowerCase()) {
    case 'pending':
      return 'pending';
    case 'processing':
      return 'processing';
    case 'in progress':
    case 'inprogress':
      return 'in_progress';
    case 'completed':
      return 'completed';
    case 'partial':
      return 'partial';
    case 'canceled':
    case 'cancelled':
      return 'canceled';
    case 'refunded':
      return 'refunded';
    default:
      return null; // statut inconnu : on conserve l'existant
  }
}

/** Statut global d'une commande à partir de ses lignes. */
export function aggregateStatus(itemStatuses: string[]): OrderStatus {
  if (itemStatuses.length === 0) return 'pending';

  const mapped = itemStatuses.map((s) => mapProviderStatus(s) ?? (s.startsWith('failed') ? 'failed' : 'pending'));

  if (mapped.every((s) => s === 'completed')) return 'completed';
  if (mapped.every((s) => s === 'canceled')) return 'canceled';
  if (mapped.every((s) => s === 'failed')) return 'failed';
  if (mapped.some((s) => s === 'partial')) return 'partial';
  if (mapped.some((s) => s === 'in_progress' || s === 'processing')) return 'in_progress';
  if (mapped.some((s) => s === 'completed')) return 'partial';
  return 'pending';
}

/**
 * Messages d'erreur fournisseur normalisés (SMMGenAPIReference.md §9).
 * Renvoie un code stable exploitable côté interface.
 */
export type ProviderErrorCode =
  | 'invalid_key'
  | 'invalid_service'
  | 'invalid_link'
  | 'invalid_quantity'
  | 'insufficient_funds'
  | 'duplicate_order'
  | 'invalid_order'
  | 'unavailable'
  | 'unknown';

export function classifyProviderError(message: string): ProviderErrorCode {
  const m = message.toLowerCase();

  if (m.includes('api key')) return 'invalid_key';
  if (m.includes('service id') || m.includes('incorrect service')) return 'invalid_service';
  if (m.includes('link')) return 'invalid_link';
  if (m.includes('quantity')) return 'invalid_quantity';
  if (m.includes('not enough funds') || m.includes('balance')) return 'insufficient_funds';
  if (m.includes('active order with this link')) return 'duplicate_order';
  if (m.includes('order id')) return 'invalid_order';
  if (m.includes('network') || m.includes('timeout') || m.includes('invalid json')) return 'unavailable';
  return 'unknown';
}

export const PROVIDER_ERROR_MESSAGE: Record<ProviderErrorCode, string> = {
  invalid_key: 'Provider API key is invalid or missing.',
  invalid_service: 'This service is no longer available at the provider.',
  invalid_link: 'The target link was rejected by the provider.',
  invalid_quantity: 'The quantity is outside the range accepted by the provider.',
  insufficient_funds: 'Insufficient balance on the provider account.',
  duplicate_order: 'An active order already exists for this link.',
  invalid_order: 'Unknown order at the provider.',
  unavailable: 'The provider is unreachable. The order was saved and can be retried.',
  unknown: 'The provider returned an unexpected error.',
};
