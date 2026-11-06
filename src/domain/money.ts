/** Formatage des montants en francs CFA (XOF, sans décimales). */

const fmt = new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 0 });

/** 12500 -> "12 500 F" (espace insécable fine remplacée par une espace insécable standard). */
export function formatF(amount: number, opts: { sign?: boolean } = {}): string {
  const n = Math.round(amount);
  const body = fmt.format(Math.abs(n)).replace(/ /g, ' ');
  const sign = n < 0 ? '−' : opts.sign && n > 0 ? '+' : '';
  return `${sign}${body} F`;
}

/** Convertit une saisie ("12 500", "12.500", "12500F") en entier positif, ou null si invalide. */
export function parseAmount(input: string): number | null {
  const digits = input.replace(/[^\d]/g, '');
  if (!digits) return null;
  const n = Number(digits);
  if (!Number.isSafeInteger(n) || n <= 0) return null;
  return n;
}

/** Affichage pendant la saisie : "12500" -> "12 500". */
export function formatInput(input: string): string {
  const digits = input.replace(/[^\d]/g, '').replace(/^0+(?=\d)/, '').slice(0, 12);
  if (!digits) return '';
  return fmt.format(Number(digits)).replace(/ /g, ' ');
}

export function percent(part: number, total: number): number {
  if (total <= 0) return 0;
  return Math.round((part / total) * 100);
}
