import 'server-only';

/**
 * Client de l'API SMMGen (standard Perfect Panel v2).
 * Voir SOURCE/SMMGenAPIReference.md à la racine du dépôt.
 *
 * SERVEUR UNIQUEMENT — la clé donne accès au solde réel du panel.
 */

export const SMMGEN_API_URL = process.env.SMMGEN_API_URL ?? 'https://my.smmgen.com/api/v2';

export class SmmGenError extends Error {}

export type SmmGenService = {
  service: number | string;
  name: string;
  type: string;
  category: string;
  rate: string;
  min: string;
  max: string;
  refill?: boolean;
  cancel?: boolean;
};

export type SmmGenStatus = {
  charge?: string;
  start_count?: string;
  status?: string;
  remains?: string;
  currency?: string;
  error?: string;
};

/** Champs `add` requis selon le `type` du service (doc §4). */
export const TYPE_FIELDS: Record<string, string[]> = {
  Default: ['service', 'link', 'quantity'],
  Package: ['service', 'link'],
  'Custom Comments': ['service', 'link', 'comments'],
  Mentions: ['service', 'link', 'quantity', 'usernames'],
  'Mentions with Hashtags': ['service', 'link', 'quantity', 'usernames', 'hashtags'],
  'Mentions Custom List': ['service', 'link', 'usernames'],
  'Mentions Hashtag': ['service', 'link', 'quantity', 'hashtag'],
  'Mentions User Followers': ['service', 'link', 'quantity', 'username'],
  'Mentions Media Likers': ['service', 'link', 'quantity', 'media'],
  'Custom Comments Package': ['service', 'link', 'comments'],
  'Comment Likes': ['service', 'link', 'quantity', 'username'],
  Poll: ['service', 'link', 'quantity', 'answer_number'],
  'Invites from Groups': ['service', 'link', 'quantity', 'groups'],
  Subscriptions: ['service', 'username', 'min', 'max', 'delay'],
  'Web Traffic': ['service', 'link', 'quantity', 'country', 'device', 'type_of_traffic'],
};

/** Lève une erreur si un champ requis pour ce type de service est absent. */
export function validateOrder(serviceType: string, data: Record<string, unknown>) {
  const required = TYPE_FIELDS[serviceType];
  if (!required) throw new SmmGenError(`Unknown service type: ${serviceType}`);

  const missing = required.filter((f) => data[f] === undefined || data[f] === '');
  if (missing.length) {
    throw new SmmGenError(`Missing fields for "${serviceType}": ${missing.join(', ')}`);
  }

  if (serviceType === 'Web Traffic') {
    if (String(data.type_of_traffic) === '1' && !data.google_keyword) {
      throw new SmmGenError('google_keyword is required when type_of_traffic = 1');
    }
    if (String(data.type_of_traffic) === '2' && !data.referring_url) {
      throw new SmmGenError('referring_url is required when type_of_traffic = 2');
    }
  }

  return true;
}

/** `rate` est un prix pour 1000 unités. */
export const priceFor = (ratePer1000: number | string, quantity: number | string) =>
  (Number(ratePer1000) * Number(quantity)) / 1000;

export class SmmGen {
  private apiKey: string;
  private apiUrl: string;
  private timeoutMs: number;

  constructor(apiKey?: string, { apiUrl = SMMGEN_API_URL, timeoutMs = 30_000 } = {}) {
    const key = apiKey ?? process.env.SMMGEN_API_KEY;
    if (!key) throw new SmmGenError('SMMGEN_API_KEY is not set');
    this.apiKey = key;
    this.apiUrl = apiUrl;
    this.timeoutMs = timeoutMs;
  }

  private async post<T>(fields: Record<string, string | number>): Promise<T> {
    const body = new URLSearchParams({ key: this.apiKey });
    Object.entries(fields).forEach(([k, v]) => body.set(k, String(v)));

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);

    let response: Response;
    let text: string;
    try {
      response = await fetch(this.apiUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body,
        signal: controller.signal,
        cache: 'no-store',
      });
      text = await response.text();
    } catch (e) {
      throw new SmmGenError(`Network error: ${(e as Error).message}`);
    } finally {
      clearTimeout(timer);
    }

    let json: unknown;
    try {
      json = JSON.parse(text);
    } catch {
      // L'API renvoie parfois une page HTML d'erreur avec un statut 200.
      throw new SmmGenError(`Invalid JSON (HTTP ${response.status}): ${text.slice(0, 300)}`);
    }

    // Une erreur logique arrive avec un HTTP 200 : toujours tester `error` d'abord.
    if (json && typeof json === 'object' && 'error' in json) {
      const message = (json as { error: unknown }).error;
      if (typeof message === 'string') throw new SmmGenError(`API error: ${message}`);
    }

    return json as T;
  }

  services() {
    return this.post<SmmGenService[]>({ action: 'services' });
  }

  balance() {
    return this.post<{ balance: string; currency: string }>({ action: 'balance' });
  }

  /** `data` doit contenir les champs exigés par le TYPE du service. */
  addOrder(data: Record<string, string | number>) {
    return this.post<{ order: number }>({ action: 'add', ...data });
  }

  status(orderId: number | string) {
    return this.post<SmmGenStatus>({ action: 'status', order: orderId });
  }

  multiStatus(ids: Array<number | string>) {
    return this.post<Record<string, SmmGenStatus>>({
      action: 'status',
      orders: ids.slice(0, 100).join(','),
    });
  }

  refill(orderId: number | string) {
    return this.post<{ refill: string }>({ action: 'refill', order: orderId });
  }

  refillStatus(refillId: number | string) {
    return this.post<{ status: string }>({ action: 'refill_status', refill: refillId });
  }

  cancel(ids: Array<number | string>) {
    return this.post<Array<{ order: number; cancel: unknown }>>({
      action: 'cancel',
      orders: ids.slice(0, 100).join(','),
    });
  }
}

export const hasSmmGenKey = () => Boolean(process.env.SMMGEN_API_KEY);
