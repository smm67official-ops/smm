import { isValidWhatsApp, normalizeWhatsApp } from '@/lib/whatsapp';

/**
 * Validations partagées par les routes d'administration et les
 * formulaires. Isomorphe volontairement : le navigateur doit refuser une
 * saisie invalide tout de suite, le serveur reste seul juge.
 */

export type Validation<T> = { ok: true; value: T } | { ok: false; error: string };

/**
 * RIB marocain : 24 chiffres. On accepte les espaces et tirets de
 * lisibilité, on stocke la forme normalisée.
 *
 * Le champ reste facultatif — un compte Cash Plus n'a pas de RIB — mais
 * s'il est renseigné, il doit être exploitable : un RIB tronqué ne se
 * détecte qu'au moment où un virement échoue, trop tard.
 */
export const RIB_LENGTH = 24;

export function normalizeRib(input: string): string {
  return (input ?? '').replace(/[\s-]/g, '');
}

export function validateRib(input: string | null | undefined): Validation<string | null> {
  const raw = (input ?? '').trim();
  if (!raw) return { ok: true, value: null };

  const digits = normalizeRib(raw);

  if (!/^\d+$/.test(digits)) return { ok: false, error: 'RIB_NOT_NUMERIC' };
  if (digits.length !== RIB_LENGTH) return { ok: false, error: 'RIB_LENGTH' };

  return { ok: true, value: digits };
}

export function validateWhatsAppNumber(input: string | null | undefined): Validation<string> {
  const raw = (input ?? '').trim();
  if (!raw) return { ok: false, error: 'NUMBER_REQUIRED' };
  if (!isValidWhatsApp(raw)) return { ok: false, error: 'NUMBER_INVALID' };
  return { ok: true, value: normalizeWhatsApp(raw) };
}

export function validateLabel(input: string | null | undefined): Validation<string> {
  const value = (input ?? '').trim();
  if (!value) return { ok: false, error: 'LABEL_REQUIRED' };
  if (value.length > 60) return { ok: false, error: 'LABEL_TOO_LONG' };
  return { ok: true, value };
}

/** Types d'icône acceptés, et taille maximale. */
export const ICON_MIME_TYPES = ['image/png', 'image/jpeg', 'image/webp', 'image/svg+xml'];
export const ICON_MAX_BYTES = 512 * 1024;

export function validateIconFile(file: {
  type: string;
  size: number;
}): Validation<true> {
  if (!ICON_MIME_TYPES.includes(file.type)) return { ok: false, error: 'ICON_TYPE' };
  if (file.size > ICON_MAX_BYTES) return { ok: false, error: 'ICON_TOO_LARGE' };
  if (file.size === 0) return { ok: false, error: 'ICON_EMPTY' };
  return { ok: true, value: true };
}

/** Messages lisibles — une seule table, partagée serveur et navigateur. */
export const VALIDATION_MESSAGES: Record<string, string> = {
  LABEL_REQUIRED: 'A label is required.',
  LABEL_TOO_LONG: 'Label is too long (60 characters max).',
  NUMBER_REQUIRED: 'A WhatsApp number is required.',
  NUMBER_INVALID: 'Enter a valid number (8 to 15 digits, international format).',
  NAME_REQUIRED: 'A name is required.',
  RIB_NOT_NUMERIC: 'A RIB contains digits only.',
  RIB_LENGTH: `A RIB must be exactly ${RIB_LENGTH} digits.`,
  REACHABLE_REQUIRED: 'Fill in an account number or a RIB — otherwise the client cannot pay.',
  ICON_TYPE: 'Icon must be a PNG, JPEG, WebP or SVG file.',
  ICON_TOO_LARGE: 'Icon is too large (512 KB max).',
  ICON_EMPTY: 'The selected file is empty.',
  DUPLICATE_NUMBER: 'This number is already registered.',
};

export const messageFor = (code: string) => VALIDATION_MESSAGES[code] ?? code;
