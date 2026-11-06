import { diffDays } from './dates';
import { inPeriod, periodAt, shiftPeriod, type PeriodConfig } from './period';
import type { Goal, Transaction } from './types';

export interface GoalStatus {
  saved: number;
  remaining: number;
  ratio: number;
  reached: boolean;
  /** Montant à mettre de côté par période pour tenir l'échéance (null sans échéance). */
  perPeriod: number | null;
  daysLeft: number | null;
}

export function goalStatus(goal: Goal, txs: Transaction[], cfg: PeriodConfig, todayISO: string): GoalStatus {
  const saved = txs
    .filter((t) => t.goalId === goal.id && t.type === 'epargne')
    .reduce((s, t) => s + t.amount, 0);
  const remaining = Math.max(0, goal.target - saved);
  const ratio = goal.target > 0 ? Math.min(1, saved / goal.target) : 0;
  const reached = goal.target > 0 && saved >= goal.target;

  let perPeriod: number | null = null;
  let daysLeft: number | null = null;
  if (goal.deadline) {
    daysLeft = diffDays(todayISO, goal.deadline);
    // Nombre de périodes restantes, période en cours incluse (minimum 1, plafonné).
    let count = 1;
    let p = periodAt(cfg, todayISO);
    while (goal.deadline > p.end && !inPeriod(p, goal.deadline) && count < 2000) {
      p = shiftPeriod(cfg, p, 1);
      count++;
    }
    perPeriod = remaining > 0 ? Math.ceil(remaining / count) : 0;
  }
  return { saved, remaining, ratio, reached, perPeriod, daysLeft };
}
