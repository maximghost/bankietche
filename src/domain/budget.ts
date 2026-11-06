import { daysLeftInPeriod, elapsedRatio, inPeriod, shiftPeriod, type Period, type PeriodConfig } from './period';
import type { Category, PaymentMethod, Transaction } from './types';

export interface CategoryLine {
  category: Category;
  spent: number;
  budget: number;
  /** Ratio dépensé / budget (0 si pas de budget). */
  ratio: number;
}

export interface PeriodSummary {
  period: Period;
  income: number;
  expense: number;
  saving: number;
  /**
   * Argent disponible (toutes périodes confondues) à la fin de la période,
   * ou aujourd'hui si la période est en cours : entrées − dépenses − épargne.
   * C'est l'argent que l'utilisateur a réellement en poche / sur son compte.
   */
  available: number;
  /** Somme des budgets des catégories de dépense actives (par période). */
  totalBudget: number;
  /**
   * Montant de référence affiché en grand :
   *  - avec budgets : budget total − dépenses de la période ;
   *  - sans budget : argent disponible.
   */
  remaining: number;
  remainingMode: 'budget' | 'available';
  daysLeft: number;
  /** Montant conseillé par jour jusqu'à la fin de la période (0 si rien à répartir). */
  perDay: number;
  /** Part de la période écoulée (0 à 1). */
  elapsed: number;
  byCategory: CategoryLine[];
  byMethod: { method: PaymentMethod; amount: number }[];
  /** Catégories ayant atteint au moins 80 % de leur budget. */
  alerts: CategoryLine[];
}

export const signed = (t: Transaction) => (t.type === 'revenu' ? t.amount : -t.amount);

export function transactionsIn(txs: Transaction[], p: Period): Transaction[] {
  return txs.filter((t) => inPeriod(p, t.date));
}

export function sumByType(txs: Transaction[]) {
  let income = 0;
  let expense = 0;
  let saving = 0;
  for (const t of txs) {
    if (t.type === 'revenu') income += t.amount;
    else if (t.type === 'depense') expense += t.amount;
    else saving += t.amount;
  }
  return { income, expense, saving };
}

/** Argent disponible à une date (opérations datées jusqu'à ce jour inclus). */
export function availableAt(txs: Transaction[], date: string): number {
  let s = 0;
  for (const t of txs) if (t.date <= date) s += signed(t);
  return s;
}

export function summarizePeriod(
  allTxs: Transaction[],
  categories: Category[],
  period: Period,
  todayISO: string,
): PeriodSummary {
  const txs = transactionsIn(allTxs, period);
  const { income, expense, saving } = sumByType(txs);
  const available = availableAt(allTxs, todayISO < period.end ? (todayISO < period.start ? period.start : todayISO) : period.end);

  const spentByCat = new Map<string, number>();
  const byMethodMap = new Map<PaymentMethod, number>();
  for (const t of txs) {
    if (t.type !== 'depense') continue;
    if (t.categoryId) spentByCat.set(t.categoryId, (spentByCat.get(t.categoryId) ?? 0) + t.amount);
    byMethodMap.set(t.method, (byMethodMap.get(t.method) ?? 0) + t.amount);
  }

  const expenseCats = categories.filter((c) => c.kind === 'depense');
  const byCategory: CategoryLine[] = expenseCats
    .map((category) => {
      const spent = spentByCat.get(category.id) ?? 0;
      const budget = category.archived ? 0 : category.budget;
      return { category, spent, budget, ratio: budget > 0 ? spent / budget : 0 };
    })
    .filter((l) => l.spent > 0 || l.budget > 0)
    .sort((a, b) => b.spent - a.spent || b.budget - a.budget);

  const totalBudget = expenseCats.filter((c) => !c.archived).reduce((s, c) => s + Math.max(0, c.budget), 0);
  const remainingMode = totalBudget > 0 ? 'budget' : 'available';
  const remaining = remainingMode === 'budget' ? totalBudget - expense : available;
  const daysLeft = daysLeftInPeriod(period, todayISO);
  const perDay = daysLeft > 0 && remaining > 0 ? Math.floor(remaining / daysLeft) : 0;

  const byMethod = [...byMethodMap.entries()]
    .map(([method, amount]) => ({ method, amount }))
    .sort((a, b) => b.amount - a.amount);

  return {
    period, income, expense, saving, available, totalBudget, remaining, remainingMode,
    daysLeft, perDay, elapsed: elapsedRatio(period, todayISO), byCategory, byMethod,
    alerts: byCategory.filter((l) => l.budget > 0 && l.ratio >= 0.8),
  };
}

/** Totaux des N dernières périodes (la plus ancienne en premier). */
export function periodTrend(cfg: PeriodConfig, allTxs: Transaction[], last: Period, count: number) {
  const periods: Period[] = [last];
  for (let i = 1; i < count; i++) periods.unshift(shiftPeriod(cfg, periods[0], -1));
  return periods.map((period) => ({ period, ...sumByType(transactionsIn(allTxs, period)) }));
}

/** Variation en % des dépenses par rapport à la période précédente (null sans référence). */
export function expenseChangeVsPrevious(cfg: PeriodConfig, allTxs: Transaction[], p: Period): number | null {
  const prev = sumByType(transactionsIn(allTxs, shiftPeriod(cfg, p, -1))).expense;
  if (prev === 0) return null;
  const cur = sumByType(transactionsIn(allTxs, p)).expense;
  return Math.round(((cur - prev) / prev) * 100);
}
