import { messageFor, validateRib } from '@/lib/settings-validation';

/**
 * Lecture et contrôle des champs d'un moyen de paiement.
 *
 * Vit hors des routes : un fichier `route.ts` ne peut exporter que des
 * gestionnaires HTTP, Next.js rejette le reste à la compilation. Les deux
 * routes (création et modification) partagent donc ce module, ce qui
 * garantit aussi qu'elles valident exactement de la même façon.
 *
 * Le formulaire arrive en `multipart/form-data` : c'est le seul format
 * qui transporte le fichier d'icône avec les champs texte.
 */
export type MethodFields = {
  name: string;
  account_number: string | null;
  rib: string | null;
  instructions: string | null;
  is_active: boolean;
  position: number;
};

export function readMethodFields(form: FormData):
  | { ok: true; fields: MethodFields }
  | { ok: false; error: string } {
  const text = (key: string) => {
    const value = form.get(key);
    return typeof value === 'string' && value.trim() ? value.trim() : null;
  };

  const name = text('name');
  if (!name) return { ok: false, error: messageFor('NAME_REQUIRED') };

  const rib = validateRib(text('rib'));
  if (!rib.ok) return { ok: false, error: messageFor(rib.error) };

  const account = text('account_number');

  // Contrainte tenue également en base ; reprise ici pour renvoyer un
  // message utile plutôt que l'erreur brute de PostgreSQL.
  if (!account && !rib.value) {
    return { ok: false, error: messageFor('REACHABLE_REQUIRED') };
  }

  const position = Number(form.get('position') ?? 0);

  return {
    ok: true,
    fields: {
      name,
      account_number: account,
      rib: rib.value,
      instructions: text('instructions'),
      is_active: form.get('is_active') !== 'false',
      position: Number.isFinite(position) ? position : 0,
    },
  };
}
