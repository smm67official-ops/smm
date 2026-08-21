import { BRAND } from '@/lib/brand';

/**
 * Normalisation des numéros et construction du message WhatsApp.
 * Module isomorphe : utilisé par le formulaire (navigateur), la page de
 * confirmation et le back-office.
 */

/** Indicatif appliqué à un numéro saisi au format national (ex. 0612…). */
export const DEFAULT_COUNTRY_CODE =
  process.env.NEXT_PUBLIC_DEFAULT_COUNTRY_CODE?.replace(/\D/g, '') || '212';

/** Numéro professionnel qui reçoit les demandes de finalisation. */
export const BUSINESS_WHATSAPP =
  process.env.NEXT_PUBLIC_WHATSAPP_BUSINESS_NUMBER?.replace(/\D/g, '') || '';

/**
 * Ramène une saisie libre à une suite de chiffres au format international,
 * sans `+` ni séparateur — c'est ce qu'attend `wa.me`.
 *
 *   "+212 612-345-678" → "212612345678"
 *   "00212612345678"   → "212612345678"
 *   "0612345678"       → "212612345678"  (indicatif par défaut)
 */
export function normalizeWhatsApp(input: string, countryCode = DEFAULT_COUNTRY_CODE): string {
  let digits = (input ?? '').replace(/\D/g, '');
  if (!digits) return '';

  if (digits.startsWith('00')) digits = digits.slice(2);

  // Numéro national : on remplace le 0 de service par l'indicatif pays.
  if (digits.startsWith('0')) digits = countryCode + digits.replace(/^0+/, '');

  return digits;
}

/** Contrôle de plausibilité : 8 à 15 chiffres (recommandation E.164). */
export function isValidWhatsApp(input: string): boolean {
  const digits = normalizeWhatsApp(input);
  return digits.length >= 8 && digits.length <= 15;
}

/** Affichage lisible : "212612345678" → "+212 612 345 678" */
export function formatWhatsApp(digits: string): string {
  if (!digits) return '';
  const clean = digits.replace(/\D/g, '');
  return `+${clean.replace(/(\d{3})(?=\d)/g, '$1 ').trim()}`;
}

export type WhatsAppOrderItem = {
  service_name: string;
  platform?: string | null;
  link?: string | null;
  quantity: number;
  charge: number;
  extras?: Record<string, unknown> | null;
};

export type WhatsAppOrder = {
  id: string;
  created_at?: string;
  total: number;
  first_name?: string | null;
  last_name?: string | null;
  whatsapp?: string | null;
  email?: string | null;
};

/** Libellés lisibles des champs fournisseur — jamais de clé technique brute. */
const EXTRA_LABELS: Record<string, string> = {
  comments: 'Comments',
  usernames: 'Usernames',
  hashtags: 'Hashtags',
  hashtag: 'Hashtag',
  username: 'Username',
  media: 'Media URL',
  answer_number: 'Poll answer',
  groups: 'Groups',
  country: 'Country',
  device: 'Device',
  type_of_traffic: 'Traffic type',
  google_keyword: 'Google keyword',
  referring_url: 'Referring URL',
  runs: 'Drip-feed runs',
  interval: 'Drip-feed interval (min)',
};

const DEVICE_LABELS: Record<string, string> = {
  '1': 'Desktop',
  '2': 'Mobile (Android)',
  '3': 'Mobile (iOS)',
  '4': 'Mixed (mobile)',
  '5': 'Mixed (mobile & desktop)',
};

const TRAFFIC_LABELS: Record<string, string> = {
  '1': 'Google keyword',
  '2': 'Custom referrer',
  '3': 'Blank referrer',
};

/** Met en forme une valeur d'extra sans jamais exposer de JSON. */
function formatExtra(key: string, value: unknown): string | null {
  if (value === null || value === undefined || value === '') return null;

  if (key === 'device') return DEVICE_LABELS[String(value)] ?? String(value);
  if (key === 'type_of_traffic') return TRAFFIC_LABELS[String(value)] ?? String(value);

  const text = String(value).trim();
  if (!text) return null;

  // Les listes multilignes sont résumées : le détail est déjà en base.
  const lines = text.split(/\r?\n/).filter(Boolean);
  if (lines.length > 3) return `${lines.length} entries (first: ${lines[0].slice(0, 40)}…)`;
  if (lines.length > 1) return lines.join(' | ');

  return text.length > 120 ? `${text.slice(0, 120)}…` : text;
}

const money = (value: number) => `$${Number(value ?? 0).toFixed(2)}`;

/**
 * Message pré-rempli, lisible par un humain.
 * Aucune donnée technique interne (UUID complet de service, clés API,
 * identifiants fournisseur, JSON brut) n'y figure.
 */
export function buildWhatsAppMessage({
  order,
  items,
  brand = BRAND.name,
}: {
  order: WhatsAppOrder;
  items: WhatsAppOrderItem[];
  brand?: string;
}): string {
  const customer = [order.first_name, order.last_name].filter(Boolean).join(' ');

  const lines: string[] = [
    `Hello ${brand} 👋`,
    '',
    `I would like to complete my order.`,
    '',
    `🧾 Order ID: ${order.id.slice(0, 8).toUpperCase()}`,
  ];

  if (customer) lines.push(`👤 Name: ${customer}`);
  if (order.whatsapp) lines.push(`📱 WhatsApp: ${formatWhatsApp(order.whatsapp)}`);

  lines.push('', items.length > 1 ? '📦 Services:' : '📦 Service:');

  items.forEach((item, index) => {
    const prefix = items.length > 1 ? `${index + 1}. ` : '';
    const platform = item.platform ? ` (${item.platform})` : '';

    lines.push(`${prefix}${item.service_name}${platform}`);
    if (item.link) lines.push(`   🔗 Link: ${item.link}`);
    lines.push(`   🔢 Quantity: ${item.quantity.toLocaleString('en-US')}`);
    lines.push(`   💵 Price: ${money(item.charge)}`);

    Object.entries(item.extras ?? {}).forEach(([key, value]) => {
      const label = EXTRA_LABELS[key];
      if (!label) return; // champ inconnu : on ne l'expose pas
      const formatted = formatExtra(key, value);
      if (formatted) lines.push(`   • ${label}: ${formatted}`);
    });
  });

  lines.push('', `💰 Total: ${money(order.total)}`, `💳 Payment: Wallet (already debited)`);

  return lines.join('\n');
}

/** Lien `wa.me` avec message encodé. Renvoie null si le numéro manque. */
export function buildWhatsAppLink(phone: string, message: string): string | null {
  const digits = normalizeWhatsApp(phone);
  if (!digits) return null;
  return `https://wa.me/${digits}?text=${encodeURIComponent(message)}`;
}
