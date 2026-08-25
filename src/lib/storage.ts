import 'server-only';
import { createAdminClient } from '@/lib/supabase/admin';
import { validateIconFile } from '@/lib/settings-validation';

/**
 * Dépôt des icônes de moyens de paiement.
 *
 * Le seau est public en lecture : ces icônes s'affichent sur la page de
 * recharge, une URL signée expirerait au mauvais moment. L'écriture reste
 * réservée à la clé de service, donc aux routes d'administration.
 */
export const ICON_BUCKET = 'payment-icons';

/**
 * Crée le seau s'il manque.
 *
 * Appelé avant chaque dépôt plutôt que documenté dans un guide
 * d'installation : un seau oublié ne se manifeste que par un échec
 * d'upload en production, et la création est idempotente.
 */
async function ensureBucket(): Promise<void> {
  const admin = createAdminClient();
  const { data } = await admin.storage.getBucket(ICON_BUCKET);
  if (data) return;

  await admin.storage.createBucket(ICON_BUCKET, {
    public: true,
    fileSizeLimit: 1024 * 1024,
    allowedMimeTypes: ['image/png', 'image/jpeg', 'image/webp', 'image/svg+xml'],
  });
}

export type UploadResult =
  | { ok: true; url: string }
  | { ok: false; error: string };

const EXTENSIONS: Record<string, string> = {
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/webp': 'webp',
  'image/svg+xml': 'svg',
};

/** Dépose une icône et renvoie son URL publique. */
export async function uploadPaymentIcon(file: File): Promise<UploadResult> {
  const valid = validateIconFile({ type: file.type, size: file.size });
  if (!valid.ok) return { ok: false, error: valid.error };

  await ensureBucket();

  const admin = createAdminClient();
  const extension = EXTENSIONS[file.type] ?? 'png';

  /*
    Nom aléatoire, jamais celui du fichier d'origine : un nom fourni par
    l'utilisateur peut contenir des séparateurs de chemin, et deux envois
    successifs du même fichier doivent produire deux objets distincts
    plutôt que d'écraser silencieusement le précédent.
  */
  const path = `${crypto.randomUUID()}.${extension}`;

  const { error } = await admin.storage
    .from(ICON_BUCKET)
    .upload(path, file, { contentType: file.type, upsert: false });

  if (error) return { ok: false, error: error.message };

  const { data } = admin.storage.from(ICON_BUCKET).getPublicUrl(path);
  return { ok: true, url: data.publicUrl };
}

/**
 * Retire une icône devenue inutile.
 *
 * Silencieux à dessein : l'échec de suppression d'un fichier orphelin ne
 * doit pas faire échouer la mise à jour du moyen de paiement, qui est
 * l'opération que l'administrateur a demandée.
 */
export async function deletePaymentIcon(url: string | null | undefined): Promise<void> {
  if (!url || !url.includes(`/${ICON_BUCKET}/`)) return;

  const path = url.split(`/${ICON_BUCKET}/`).pop();
  if (!path) return;

  const admin = createAdminClient();
  await admin.storage.from(ICON_BUCKET).remove([decodeURIComponent(path)]);
}
