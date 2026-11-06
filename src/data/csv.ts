import type { AppData } from '../domain/types';
import { PAYMENT_METHODS } from '../domain/types';

const TYPE_LABELS = { depense: 'Dépense', revenu: 'Entrée', epargne: 'Épargne' } as const;

function cell(v: string | number): string {
  const s = String(v);
  return /[";\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

/**
 * Export des opérations au format CSV lisible par Excel / LibreOffice / Google Sheets
 * (séparateur « ; » et BOM UTF-8 pour les accents, convention française).
 */
export function buildCsv(data: AppData): string {
  const cats = new Map(data.categories.map((c) => [c.id, c.name]));
  const goals = new Map(data.goals.map((g) => [g.id, g.name]));
  const tontines = new Map(data.tontines.map((t) => [t.id, t.name]));
  const methods = new Map(PAYMENT_METHODS.map((m) => [m.id, m.label]));

  const header = ['Date', 'Type', 'Catégorie', 'Montant (F CFA)', 'Moyen de paiement', 'Objectif', 'Tontine', 'Note'];
  const rows = [...data.transactions]
    .sort((a, b) => (a.date === b.date ? a.createdAt - b.createdAt : a.date < b.date ? -1 : 1))
    .map((t) => [
      t.date,
      TYPE_LABELS[t.type],
      t.categoryId ? (cats.get(t.categoryId) ?? '') : '',
      t.type === 'revenu' ? t.amount : -t.amount,
      methods.get(t.method) ?? t.method,
      t.goalId ? (goals.get(t.goalId) ?? '') : '',
      t.tontineId ? (tontines.get(t.tontineId) ?? '') : '',
      t.note ?? '',
    ]);
  return '﻿' + [header, ...rows].map((r) => r.map(cell).join(';')).join('\r\n');
}

export function csvFileName(now: Date = new Date()): string {
  return `bankietche-operations-${now.toISOString().slice(0, 10)}.csv`;
}
