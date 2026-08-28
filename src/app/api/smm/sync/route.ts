import { NextResponse, type NextRequest } from 'next/server';
import { getGlobalMargin } from '@/lib/settings';
import { sellingPrice } from '@/lib/pricing';
import { SmmGen, SmmGenError } from '@/lib/smmgen';
import { createAdminClient } from '@/lib/supabase/admin';
import { detectPlatform, slugify } from '@/lib/platforms';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

/** Marge appliquée au prix fournisseur, en pourcentage. */
/*
  La marge vient des réglages, plus d'une variable d'environnement.

  `SMM_MARKUP_PERCENT` était figée au build : la changer imposait un
  redéploiement, et le back-office n'avait aucune prise dessus. Elle ne
  sert plus que de valeur initiale, dans `DEFAULT_SETTINGS`.
*/



/**
 * Importe le catalogue SMMGen dans Supabase.
 *
 *   curl -X POST http://localhost:3000/api/smm/sync -H "x-sync-secret: $SMM_SYNC_SECRET"
 *
 * À planifier (cron) pour suivre les variations de prix et de disponibilité.
 */
export async function POST(request: NextRequest) {
  const secret = process.env.SMM_SYNC_SECRET;
  if (!secret || request.headers.get('x-sync-secret') !== secret) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let services: Awaited<ReturnType<SmmGen['services']>>;
  try {
    services = await new SmmGen().services();
  } catch (e) {
    const message = e instanceof SmmGenError ? e.message : String(e);
    return NextResponse.json({ error: message }, { status: 502 });
  }

  if (!Array.isArray(services)) {
    return NextResponse.json({ error: 'Unexpected provider response' }, { status: 502 });
  }

  /**
   * Le catalogue fournisseur contient des lignes de séparation
   * (« ----------- ») qui ne sont pas des services commandables :
   * elles n'ont aucun caractère alphanumérique et portent des tarifs
   * fantaisistes. On les écarte à l'import.
   */
  const isRealService = (name: string) => /[\p{L}\p{N}]{3,}/u.test(name ?? '');
  const skipped = services.length;
  services = services.filter((s) => isRealService(s.name));
  const skippedCount = skipped - services.length;

  const supabase = createAdminClient();

  // 1. Catégories — dédoublonnées sur le libellé fournisseur.
  const categoryNames = [...new Set(services.map((s) => s.category).filter(Boolean))];
  const categoryRows = categoryNames.map((name, index) => ({
    name,
    slug: `${slugify(name)}-${index}`,
    platform: detectPlatform(name),
    position: index,
  }));

  const { error: categoryError } = await supabase
    .from('service_categories')
    .upsert(categoryRows, { onConflict: 'name' });

  if (categoryError) {
    return NextResponse.json({ error: categoryError.message }, { status: 500 });
  }

  const { data: categories } = await supabase.from('service_categories').select('id, name');
  const categoryIdByName = new Map((categories ?? []).map((c) => [c.name, c.id]));

  /**
   * Marges individuelles.
   *
   * Un service en marge « custom » garde la sienne à travers l'import ;
   * seul son coût fournisseur est rafraîchi, et son prix est recalculé
   * à partir de cette marge. Un prix figé en valeur absolue serait
   * devenu une marge négative dès que le fournisseur augmente.
   */
  const globalMargin = await getGlobalMargin();

  const { data: marginRows } = await supabase
    .from('services')
    .select('provider_service_id, custom_margin')
    .eq('provider', 'smmgen')
    .eq('margin_mode', 'custom');

  const customMargin = new Map(
    (marginRows ?? [])
      .filter((row) => row.custom_margin !== null)
      .map((row) => [Number(row.provider_service_id), Number(row.custom_margin)])
  );

  /**
   * Noms réécrits pour la boutique : les libellés fournisseur sont bruts
   * (« ~ [A] ~ Max 100k ~ INSTANT »). Le nom d'origine reste importé
   * dans `provider_name`, seul l'affichage est préservé.
   */
  const { data: namedRows, error: namedError } = await supabase
    .from('services')
    .select('provider_service_id, name')
    .eq('provider', 'smmgen')
    .eq('name_locked', true);

  /*
    La migration 008 peut ne pas être appliquée. Plutôt que de faire
    échouer tout l'import sur une colonne absente — le catalogue serait
    alors figé —, on repère le cas et on synchronise sans la
    fonctionnalité de renommage.
  */
  const supportsRename = !namedError;
  if (namedError && !/column .* does not exist|schema cache/i.test(namedError.message)) {
    return NextResponse.json({ error: namedError.message }, { status: 500 });
  }

  const lockedName = new Map(
    (namedRows ?? []).map((row) => [Number(row.provider_service_id), String(row.name)])
  );

  // 2. Services — le prix de vente applique la marge sur le prix fournisseur.
  const serviceRows = services.map((s) => {
    const providerRate = Number(s.rate);
    const providerServiceId = Number(s.service);
    const custom = customMargin.get(providerServiceId);
    const margin = custom ?? globalMargin;
    const renamed = lockedName.get(providerServiceId);

    return {
      provider: 'smmgen',
      provider_service_id: providerServiceId,
      name: renamed ?? s.name,
      ...(supportsRename ? { provider_name: s.name, name_locked: renamed !== undefined } : {}),
      type: s.type || 'Default',
      category_name: s.category,
      category_id: categoryIdByName.get(s.category) ?? null,
      platform: detectPlatform(s.category ?? '') ?? detectPlatform(s.name ?? ''),
      provider_rate: providerRate,
      rate: sellingPrice(providerRate, margin),
      margin_mode: custom !== undefined ? 'custom' : 'global',
      custom_margin: custom ?? null,
      min: Number(s.min) || 1,
      max: Number(s.max) || 1_000_000,
      refill: Boolean(s.refill),
      cancel: Boolean(s.cancel),
      is_active: true,
      synced_at: new Date().toISOString(),
    };
  });

  // Insertion par lots : le catalogue dépasse souvent 3 000 lignes.
  const CHUNK = 500;
  for (let i = 0; i < serviceRows.length; i += CHUNK) {
    const { error } = await supabase
      .from('services')
      .upsert(serviceRows.slice(i, i + CHUNK), { onConflict: 'provider,provider_service_id' });

    if (error) {
      return NextResponse.json({ error: error.message, at: i }, { status: 500 });
    }
  }

  // 3. Les services absents de la réponse ne sont plus proposés.
  const activeIds = serviceRows.map((s) => s.provider_service_id);
  if (activeIds.length > 0) {
    await supabase
      .from('services')
      .update({ is_active: false })
      .eq('provider', 'smmgen')
      .not('provider_service_id', 'in', `(${activeIds.join(',')})`);
  }

  return NextResponse.json({
    ok: true,
    categories: categoryRows.length,
    services: serviceRows.length,
    skipped: skippedCount,
    renameSupported: supportsRename,
    customMargins: customMargin.size,
    globalMargin,
  });
}
