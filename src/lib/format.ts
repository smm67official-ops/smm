/**
 * Montant à payer.
 * Deux décimales par défaut ; on ne descend à quatre que si le montant
 * est réellement plus fin — un solde nul affichait « $0.0000 ».
 */
export const money = (value: number) => {
  const n = Number(value ?? 0);
  const fine = n.toFixed(4);
  return `$${fine.endsWith('00') ? n.toFixed(2) : fine}`;
};

/** Prix catalogue pour 1000 unités : jusqu'à 5 décimales, sans zéros inutiles. */
export const rate = (value: number) => {
  const n = Number(value ?? 0);
  return `$${n.toFixed(5).replace(/0+$/, '').replace(/\.$/, '')}`;
};

export const formatDate = (iso: string) =>
  new Date(iso).toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
