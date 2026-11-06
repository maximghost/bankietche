/**
 * Données du relevé PDF, calculées sans dépendance au rendu (testables).
 */
import { expenseChangeVsPrevious, summarizePeriod, type PeriodSummary } from '../domain/budget';
import { goalStatus, type GoalStatus } from '../domain/goals';
import { formatPeriod, periodAt, periodKindLabel, shiftPeriod, type Period } from '../domain/period';
import { tontineStatus, type TontineStatus } from '../domain/tontine';
import type { AppData, Goal, Settings, Tontine, Transaction } from '../domain/types';
import { PAYMENT_METHODS } from '../domain/types';

export interface ReportRow {
  date: string;
  label: string;
  category: string;
  method: string;
  /** Signé : positif pour une entrée. */
  amount: number;
  type: Transaction['type'];
}

export interface ReportData {
  title: string;
  periodLabel: string;
  period: Period;
  periodKind: string;
  name: string;
  generatedAt: Date;
  summary: PeriodSummary;
  change: number | null;
  goals: { goal: Goal; status: GoalStatus }[];
  tontines: { tontine: Tontine; status: TontineStatus }[];
  rows: ReportRow[];
  methods: { label: string; color: string; amount: number }[];
}

const methodInfo = new Map(PAYMENT_METHODS.map((m) => [m.id, m]));
const TYPE_LABEL = { depense: 'Dépense', revenu: 'Entrée', epargne: 'Épargne' } as const;

/** Les 12 dernières périodes (la plus récente en premier), pour le choix du relevé. */
export function recentPeriods(settings: Settings, todayISO: string, count = 12): { period: Period; label: string }[] {
  const out: { period: Period; label: string }[] = [];
  let p = periodAt(settings.period, todayISO);
  for (let i = 0; i < count; i++) {
    const label = formatPeriod(settings.period, p, todayISO);
    out.push({ period: p, label: i === 0 ? `${label} (en cours)` : label });
    p = shiftPeriod(settings.period, p, -1);
  }
  return out;
}

export function buildReport(data: AppData, settings: Settings, period: Period, todayISO: string, now: Date = new Date()): ReportData {
  const cats = new Map(data.categories.map((c) => [c.id, c]));
  const summary = summarizePeriod(data.transactions, data.categories, period, todayISO);

  const rows: ReportRow[] = data.transactions
    .filter((t) => t.date >= period.start && t.date <= period.end)
    .sort((a, b) => (a.date === b.date ? a.createdAt - b.createdAt : a.date < b.date ? -1 : 1))
    .map((t) => {
      const cat = t.categoryId ? cats.get(t.categoryId) : undefined;
      const goal = t.goalId ? data.goals.find((g) => g.id === t.goalId) : undefined;
      const tontine = t.tontineId ? data.tontines.find((x) => x.id === t.tontineId) : undefined;
      const base = t.type === 'epargne' ? (goal ? `Épargne · ${goal.name}` : 'Épargne libre')
        : tontine ? `${t.type === 'depense' ? 'Cotisation' : 'Ramassage'} · ${tontine.name}` : (cat?.name ?? 'Sans catégorie');
      return {
        date: t.date,
        label: t.note && t.note.trim().toLowerCase() !== base.toLowerCase() ? `${base} — ${t.note}` : base,
        category: t.type === 'epargne' ? TYPE_LABEL.epargne : (cat?.name ?? '—'),
        method: methodInfo.get(t.method)?.label ?? t.method,
        amount: t.type === 'revenu' ? t.amount : -t.amount,
        type: t.type,
      };
    });

  return {
    title: 'Relevé personnel',
    periodLabel: formatPeriod(settings.period, period, todayISO),
    period,
    periodKind: periodKindLabel(settings.period),
    name: settings.name,
    generatedAt: now,
    summary,
    change: expenseChangeVsPrevious(settings.period, data.transactions, period),
    goals: data.goals.filter((g) => !g.archived).map((goal) => ({ goal, status: goalStatus(goal, data.transactions, settings.period, todayISO) })),
    tontines: data.tontines.filter((t) => !t.archived).map((tontine) => ({ tontine, status: tontineStatus(tontine, data.transactions, todayISO) })),
    rows,
    methods: summary.byMethod.map((m) => ({ label: methodInfo.get(m.method)?.label ?? m.method, color: methodInfo.get(m.method)?.color ?? '#94A3B8', amount: m.amount })),
  };
}

export function reportFileName(r: ReportData): string {
  return `Bankietche-releve-${r.period.start}_au_${r.period.end}.pdf`;
}
