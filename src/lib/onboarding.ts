import { normalizeWhatsApp, isValidWhatsApp } from '@/lib/whatsapp';

/**
 * Finalisation du profil.
 *
 * Une connexion Google apporte un e-mail et un nom, jamais un numéro
 * de téléphone. Le panel, lui, joint ses clients par WhatsApp — pour
 * confirmer une recharge, signaler une commande. Sans ce numéro, un
 * compte créé par Google est injoignable.
 */

/**
 * Plateformes proposées au choix.
 *
 * Alignées sur ce que le catalogue vend réellement, et ordonnées par
 * volume de services : proposer un choix que la boutique ne couvre pas
 * serait une promesse creuse.
 */
export const ONBOARDING_PLATFORMS = [
  { id: 'instagram', label: 'Instagram', icon: '/logo/instagram-icon-small.png' },
  { id: 'tiktok', label: 'TikTok', icon: '/logo/tiktok-icon-small.png' },
  { id: 'facebook', label: 'Facebook', icon: '/logo/facebook-icon-small.png' },
  { id: 'youtube', label: 'YouTube', icon: null },
  { id: 'telegram', label: 'Telegram', icon: '/logo/telegram-icon-small.png' },
  { id: 'linkedin', label: 'LinkedIn', icon: '/logo/linkedin-icon-small.png' },
  { id: 'twitter', label: 'X (Twitter)', icon: null },
  { id: 'whatsapp', label: 'WhatsApp', icon: null },
  { id: 'snapchat', label: 'Snapchat', icon: null },
  { id: 'spotify', label: 'Spotify', icon: '/logo/spotify-icon-small.png' },
] as const;

const VALID_IDS = new Set(ONBOARDING_PLATFORMS.map((p) => p.id as string));

export type OnboardingInput = { whatsapp?: unknown; platforms?: unknown };

export type OnboardingValidation =
  | { ok: true; whatsapp: string; platforms: string[] }
  | { ok: false; error: 'WHATSAPP_REQUIRED' | 'WHATSAPP_INVALID' | 'PLATFORM_REQUIRED' };

export const ONBOARDING_MESSAGE: Record<string, string> = {
  WHATSAPP_REQUIRED: 'A WhatsApp number is required.',
  WHATSAPP_INVALID: 'Enter a valid number (8 to 15 digits, international format).',
  PLATFORM_REQUIRED: 'Pick at least one platform.',
};

/**
 * Contrôle partagé par le formulaire et la route.
 *
 * Les identifiants de plateforme sont filtrés sur la liste connue : le
 * navigateur envoie ce qu'il veut, et une valeur inventée finirait
 * stockée telle quelle puis comparée à un `platform` de service qui
 * n'existe pas.
 */
export function validateOnboarding(input: OnboardingInput): OnboardingValidation {
  const raw = typeof input.whatsapp === 'string' ? input.whatsapp.trim() : '';
  if (!raw) return { ok: false, error: 'WHATSAPP_REQUIRED' };
  if (!isValidWhatsApp(raw)) return { ok: false, error: 'WHATSAPP_INVALID' };

  const list = Array.isArray(input.platforms) ? input.platforms : [];
  const platforms = [...new Set(list.filter((p): p is string => typeof p === 'string' && VALID_IDS.has(p)))];

  if (platforms.length === 0) return { ok: false, error: 'PLATFORM_REQUIRED' };

  return { ok: true, whatsapp: normalizeWhatsApp(raw), platforms };
}
