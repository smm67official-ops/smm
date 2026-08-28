import 'server-only';
import { createAdminClient } from '@/lib/supabase/admin';
import { BUSINESS_WHATSAPP, normalizeWhatsApp } from '@/lib/whatsapp';
import type { AppSettings, PaymentMethod, WhatsAppNumber } from '@/lib/supabase/types';

/**
 * Paramètres administrables : numéros WhatsApp et moyens de paiement.
 *
 * Ces deux réglages vivaient hors de la base — le numéro dans une
 * variable d'environnement figée au build, les moyens de paiement nulle
 * part. Ils sont désormais lus ici, à chaque requête, pour qu'une
 * modification dans le back-office prenne effet immédiatement.
 *
 * Aucune lecture n'est mise en cache : c'est la règle demandée
 * (« changer le numéro actif doit affecter immédiatement les nouveaux
 * parcours »). Le coût est une requête par rendu, négligeable devant
 * l'appel au fournisseur SMM que la même page effectue déjà.
 */

/**
 * `true` quand la table n'existe pas encore (migration 007 non appliquée).
 * Dans ce cas on retombe sur l'ancien comportement plutôt que de casser
 * des pages qui fonctionnaient.
 */
const isMissingTable = (message?: string) =>
  !!message && /does not exist|schema cache|not find the table/i.test(message);

/**
 * Numéro WhatsApp à utiliser partout dans l'application.
 *
 * Ordre : le numéro actif en base, puis la variable d'environnement
 * historique, puis rien. Ce repli garde le site fonctionnel tant que la
 * migration n'est pas passée, et pendant le laps de temps où aucun
 * numéro n'a encore été saisi dans le back-office.
 */
export async function getActiveWhatsAppNumber(): Promise<string> {
  const admin = createAdminClient();

  const { data, error } = await admin
    .from('whatsapp_numbers')
    .select('number')
    .eq('is_active', true)
    .maybeSingle();

  if (error && !isMissingTable(error.message)) {
    console.error('[settings] lecture du numéro WhatsApp actif :', error.message);
  }

  return normalizeWhatsApp(data?.number ?? '') || BUSINESS_WHATSAPP;
}

/** Liste complète, back-office uniquement. */
export async function listWhatsAppNumbers(): Promise<WhatsAppNumber[]> {
  const admin = createAdminClient();

  const { data, error } = await admin
    .from('whatsapp_numbers')
    .select('*')
    .order('is_active', { ascending: false })
    .order('created_at', { ascending: false });

  if (error && !isMissingTable(error.message)) {
    console.error('[settings] liste des numéros WhatsApp :', error.message);
  }

  return (data ?? []) as WhatsAppNumber[];
}

/**
 * Moyens de paiement.
 *
 * `activeOnly` par défaut : un appelant qui oublie le filtre ne doit pas
 * exposer au client des moyens désactivés. Le back-office demande
 * explicitement la liste complète.
 */
export async function listPaymentMethods(activeOnly = true): Promise<PaymentMethod[]> {
  const admin = createAdminClient();

  let query = admin
    .from('payment_methods')
    .select('*')
    .order('position', { ascending: true })
    .order('created_at', { ascending: true });

  if (activeOnly) query = query.eq('is_active', true);

  const { data, error } = await query;

  if (error && !isMissingTable(error.message)) {
    console.error('[settings] liste des moyens de paiement :', error.message);
  }

  return (data ?? []) as PaymentMethod[];
}

/**
 * Message WhatsApp de recharge.
 *
 * Construit à partir des moyens de paiement actifs : rien n'est écrit en
 * dur, retirer un moyen dans le back-office le retire de ce message au
 * prochain envoi.
 */
export function buildTopUpMessage({
  amount,
  reference,
  methods,
  locale = 'fr',
}: {
  amount: string;
  reference: string;
  methods: PaymentMethod[];
  locale?: string;
}): string {
  const wording =
    locale === 'ar'
      ? {
          hello: 'مرحبا 👋',
          intro: `أرغب في شحن محفظتي بمبلغ ${amount}.`,
          ref: `المرجع: ${reference}`,
          methodsTitle: 'طرق الدفع المتاحة:',
          proof: 'بعد الدفع، سأرسل لكم وصل الدفع للتحقق منه وشحن المحفظة.',
        }
      : locale === 'en'
        ? {
            hello: 'Hello 👋',
            intro: `I would like to top up my wallet with ${amount}.`,
            ref: `Reference: ${reference}`,
            methodsTitle: 'Available payment methods:',
            proof:
              'Once paid, I will send the receipt so you can verify it and credit my wallet.',
          }
        : {
            hello: 'Bonjour 👋',
            intro: `Je souhaite recharger mon wallet de ${amount}.`,
            ref: `Référence : ${reference}`,
            methodsTitle: 'Voici les moyens de paiement disponibles :',
            proof:
              'Après le paiement, je vous enverrai mon justificatif afin que vous puissiez vérifier et créditer mon wallet.',
          };

  const lines = [wording.hello, '', wording.intro, wording.ref];

  if (methods.length > 0) {
    lines.push('', wording.methodsTitle);

    for (const method of methods) {
      // Le compte et le RIB peuvent coexister (virement bancaire) : on
      // affiche ce qui est renseigné, sans étiquette vide.
      const parts = [
        method.account_number?.trim() ? method.account_number.trim() : null,
        method.rib?.trim() ? `RIB : ${method.rib.trim()}` : null,
      ].filter(Boolean);

      lines.push(`• ${method.name}${parts.length ? ` — ${parts.join(' — ')}` : ''}`);

      if (method.instructions?.trim()) lines.push(`   ${method.instructions.trim()}`);
    }
  }

  lines.push('', wording.proof);

  return lines.join('\n');
}


// -------------------------------------------------------------------
//  Réglages généraux
// -------------------------------------------------------------------

/**
 * Valeurs de repli.
 *
 * Servent tant que la migration 011 n'est pas appliquée, et si la ligne
 * unique venait à manquer. La marge reprend 20 %, celle qu'appliquait le
 * code auparavant : en changer ferait bouger tous les prix au premier
 * import.
 */
export const DEFAULT_SETTINGS: AppSettings = {
  id: true,
  global_service_margin: Number(process.env.SMM_MARKUP_PERCENT ?? 20),
  whatsapp_enabled: true,
  whatsapp_message: null,
  whatsapp_greeting: null,
  whatsapp_position: 'bottom-right',
  updated_at: new Date().toISOString(),
  updated_by: null,
};

/** Réglages courants. Ne lève jamais : une panne de lecture ne doit pas
 *  faire disparaître le catalogue ni le widget. */
export async function getAppSettings(): Promise<AppSettings> {
  const admin = createAdminClient();

  const { data, error } = await admin.from('app_settings').select('*').maybeSingle();

  if (error && !isMissingTable(error.message)) {
    console.error('[settings] lecture des réglages :', error.message);
  }

  return data ? ({ ...DEFAULT_SETTINGS, ...data } as AppSettings) : DEFAULT_SETTINGS;
}

/** Marge globale seule — le chemin le plus emprunté. */
export async function getGlobalMargin(): Promise<number> {
  return (await getAppSettings()).global_service_margin;
}

export type WidgetConfig = {
  enabled: boolean;
  number: string;
  message: string;
  greeting: string | null;
  position: 'bottom-right' | 'bottom-left';
};

/**
 * Configuration du widget WhatsApp, prête à l'emploi.
 *
 * Le numéro vient de `whatsapp_numbers` — sa seule source, avec sa règle
 * « un seul actif ». Il n'est pas recopié dans les réglages : deux
 * copies finiraient par diverger.
 *
 * `null` signifie « ne rien afficher » : widget désactivé, ou aucun
 * numéro actif. Un bouton qui ouvrirait WhatsApp sans destinataire ne
 * vaut pas mieux qu'un bouton absent.
 */
export async function getWhatsAppWidget(locale = 'fr'): Promise<WidgetConfig | null> {
  const [settings, number] = await Promise.all([getAppSettings(), getActiveWhatsAppNumber()]);

  if (!settings.whatsapp_enabled || !number) return null;

  const fallback =
    locale === 'ar'
      ? 'مرحبا، أود الحصول على مزيد من المعلومات.'
      : locale === 'en'
        ? 'Hello, I would like more information.'
        : "Bonjour, j'aimerais avoir plus d'informations.";

  return {
    enabled: true,
    number,
    message: settings.whatsapp_message?.trim() || fallback,
    greeting: settings.whatsapp_greeting?.trim() || null,
    position: settings.whatsapp_position,
  };
}
