import { describe, expect, it } from 'vitest';
import { expenseChangeVsPrevious, periodTrend, summarizePeriod } from '../src/domain/budget';
import { coachMessage, greeting } from '../src/domain/coach';
import { convertBudget, daysLeftInPeriod, DEFAULT_PERIOD, formatPeriod, periodAt, shiftPeriod } from '../src/domain/period';
import { addMonths, daysLeftInMonth, formatDayLabel, formatMonth } from '../src/domain/dates';
import { defaultCategories, CAT_TONTINE_COTISATION, CAT_TONTINE_RAMASSAGE } from '../src/domain/defaults';
import { goalStatus } from '../src/domain/goals';
import { formatF, formatInput, parseAmount } from '../src/domain/money';
import { tontineStatus, upcomingPayments } from '../src/domain/tontine';
import type { Tontine, Transaction } from '../src/domain/types';

let n = 0;
const tx = (p: Partial<Transaction>): Transaction => ({
  id: `t${++n}`, type: 'depense', amount: 1000, categoryId: 'dep-nourriture', method: 'mtn',
  date: '2026-11-03', createdAt: n, ...p,
});

describe('money', () => {
  it('formate en F CFA', () => {
    expect(formatF(12500)).toBe('12 500 F');
    expect(formatF(-300)).toBe('−300 F');
    expect(formatF(525, { sign: true })).toBe('+525 F');
  });
  it('parse les saisies', () => {
    expect(parseAmount('12 500')).toBe(12500);
    expect(parseAmount('1.000 F')).toBe(1000);
    expect(parseAmount('0')).toBeNull();
    expect(parseAmount('')).toBeNull();
    expect(formatInput('0012500')).toBe('12 500');
  });
});

describe('dates', () => {
  it('addMonths ramène au dernier jour', () => {
    expect(addMonths('2026-01-31', 1)).toBe('2026-02-28');
    expect(addMonths('2028-01-31', 1)).toBe('2028-02-29');
    expect(addMonths('2026-11-15', 2)).toBe('2027-01-15');
  });
  it('jours restants, aujourd’hui inclus', () => {
    expect(daysLeftInMonth('2026-11', '2026-11-06')).toBe(25);
    expect(daysLeftInMonth('2026-11', '2026-11-30')).toBe(1);
    expect(daysLeftInMonth('2026-10', '2026-11-06')).toBe(0);
    expect(daysLeftInMonth('2026-12', '2026-11-06')).toBe(31);
  });
  it('libellés', () => {
    expect(formatMonth('2026-11')).toBe('Novembre 2026');
    expect(formatDayLabel('2026-11-06', '2026-11-06')).toBe("Aujourd'hui");
    expect(formatDayLabel('2026-11-05', '2026-11-06')).toBe('Hier');
    expect(formatDayLabel('2026-11-02', '2026-11-06')).toBe('lundi 2 novembre');
  });
});

describe('périodes', () => {
  const base = { ...DEFAULT_PERIOD };
  it('calcule la période contenant une date', () => {
    expect(periodAt({ ...base, kind: 'jour' }, '2026-11-06')).toEqual({ start: '2026-11-06', end: '2026-11-06' });
    expect(periodAt({ ...base, kind: 'semaine', weekStart: 1 }, '2026-11-06')).toEqual({ start: '2026-11-02', end: '2026-11-08' });
    expect(periodAt({ ...base, kind: 'semaine', weekStart: 0 }, '2026-11-06')).toEqual({ start: '2026-11-01', end: '2026-11-07' });
    expect(periodAt({ ...base, kind: 'mois' }, '2026-11-06')).toEqual({ start: '2026-11-01', end: '2026-11-30' });
    expect(periodAt({ ...base, kind: 'mois', monthStartDay: 25 }, '2026-11-06')).toEqual({ start: '2026-10-25', end: '2026-11-24' });
    expect(periodAt({ ...base, kind: 'mois', monthStartDay: 25 }, '2026-11-25')).toEqual({ start: '2026-11-25', end: '2026-12-24' });
    expect(periodAt({ ...base, kind: 'annee' }, '2026-11-06')).toEqual({ start: '2026-01-01', end: '2026-12-31' });
    const libre = { ...base, kind: 'libre' as const, customStart: '2026-11-01', customLength: 10 };
    expect(periodAt(libre, '2026-11-06')).toEqual({ start: '2026-11-01', end: '2026-11-10' });
    expect(periodAt(libre, '2026-11-11')).toEqual({ start: '2026-11-11', end: '2026-11-20' });
    expect(periodAt(libre, '2026-10-31')).toEqual({ start: '2026-10-22', end: '2026-10-31' });
  });
  it('navigue et formate', () => {
    const w = { ...base, kind: 'semaine' as const };
    const p = periodAt(w, '2026-11-06');
    expect(shiftPeriod(w, p, -1)).toEqual({ start: '2026-10-26', end: '2026-11-01' });
    expect(formatPeriod(w, p, '2026-11-06')).toBe('2 – 8 nov.');
    expect(formatPeriod(base, periodAt(base, '2026-11-06'), '2026-11-06')).toBe('Novembre 2026');
    expect(daysLeftInPeriod(p, '2026-11-06')).toBe(3);
  });
  it('convertit les budgets entre périodes', () => {
    expect(convertBudget(30000, base, { ...base, kind: 'semaine' })).toBe(6900);
    expect(convertBudget(1000, { ...base, kind: 'jour' }, { ...base, kind: 'semaine' })).toBe(7000);
  });
});

describe('budget par période', () => {
  const cats = defaultCategories();
  const cfg = { ...DEFAULT_PERIOD, kind: 'semaine' as const };
  const p = periodAt(cfg, '2026-11-06'); // 2 au 8 novembre
  const txs = [
    tx({ type: 'revenu', amount: 50000, categoryId: 'rev-parents', date: '2026-10-28' }),
    tx({ amount: 3000, categoryId: 'dep-transport', method: 'especes', date: '2026-11-03' }),
    tx({ amount: 9000, categoryId: 'dep-nourriture', date: '2026-11-04' }),
    tx({ type: 'epargne', amount: 5000, categoryId: null, goalId: 'g1', date: '2026-11-05' }),
    tx({ amount: 6000, categoryId: 'dep-nourriture', date: '2026-10-29' }),
  ];

  it('sans budget : argent disponible cumulé (report des périodes précédentes)', () => {
    const s = summarizePeriod(txs, cats, p, '2026-11-06');
    expect(s.income).toBe(0);
    expect(s.expense).toBe(12000);
    expect(s.available).toBe(50000 - 6000 - 12000 - 5000);
    expect(s.remainingMode).toBe('available');
    expect(s.daysLeft).toBe(3);
    expect(s.perDay).toBe(9000);
  });

  it('avec budgets : budget de la période − dépenses, alertes à 80 %', () => {
    const withBudget = cats.map((c) => (c.id === 'dep-nourriture' ? { ...c, budget: 10000 } : c.id === 'dep-transport' ? { ...c, budget: 5000 } : c));
    const s = summarizePeriod(txs, withBudget, p, '2026-11-06');
    expect(s.totalBudget).toBe(15000);
    expect(s.remaining).toBe(3000);
    expect(s.perDay).toBe(1000);
    expect(s.alerts.map((a) => a.category.id)).toEqual(['dep-nourriture']);
  });

  it('dépassement : pas de montant par jour négatif', () => {
    const s = summarizePeriod([tx({ amount: 5000 })], cats, periodAt(DEFAULT_PERIOD, '2026-11-06'), '2026-11-06');
    expect(s.remaining).toBe(-5000);
    expect(s.perDay).toBe(0);
  });

  it('tendance et variation', () => {
    expect(expenseChangeVsPrevious(cfg, txs, p)).toBe(100);
    const trend = periodTrend(cfg, txs, p, 3);
    expect(trend.map((t) => t.period.start)).toEqual(['2026-10-19', '2026-10-26', '2026-11-02']);
    expect(trend[1].expense).toBe(6000);
  });
});

describe('messages personnalisés', () => {
  const cats = defaultCategories().map((c) => (c.id === 'dep-nourriture' ? { ...c, budget: 10000 } : c));
  const cfg = DEFAULT_PERIOD;
  const p = periodAt(cfg, '2026-11-06');
  const base = { name: 'Maxim', cfg, isCurrent: true, hasAnyData: true, lateTontines: 0, goalsReached: 0, todayISO: '2026-11-06' };
  it('salue par le prénom selon l’heure', () => {
    expect(greeting('Maxim', 9)).toBe('Bonjour, Maxim');
    expect(greeting('Maxim', 20)).toBe('Bonsoir, Maxim');
    expect(greeting('', 9)).toBe('Bonjour');
  });
  it('adapte le ton à la situation', () => {
    const over = summarizePeriod([tx({ amount: 12000, date: '2026-11-02' })], cats, p, '2026-11-06');
    expect(coachMessage({ ...base, summary: over }).tone).toBe('alert');
    const fast = summarizePeriod([tx({ amount: 6000, date: '2026-11-02' })], cats, p, '2026-11-06');
    expect(coachMessage({ ...base, summary: fast }).tone).toBe('warn');
    const ok = summarizePeriod([tx({ amount: 1000, date: '2026-11-02' })], cats, p, '2026-11-06');
    const m = coachMessage({ ...base, summary: ok });
    expect(m.tone).toBe('good');
    expect(coachMessage({ ...base, hasAnyData: false, summary: ok }).title).toBe('Bienvenue, Maxim !');
  });
});

describe('tontine', () => {
  const t: Tontine = {
    id: 'to1', name: 'Tontine du quartier', amount: 2000, frequency: 'semaine',
    startDate: '2026-10-16', members: 5, myTurn: 4, archived: false, createdAt: 1,
  };
  const pay = (date: string, amount = 2000) =>
    tx({ amount, date, tontineId: 'to1', categoryId: CAT_TONTINE_COTISATION });

  it('calcule échéances, retard et ramassage', () => {
    // Échéances : 16/10, 23/10, 30/10, 06/11, 13/11
    const s = tontineStatus(t, [pay('2026-10-16'), pay('2026-10-23')], '2026-11-06');
    expect(s.pot).toBe(10000);
    expect(s.dueCount).toBe(4);
    expect(s.paidCount).toBe(2);
    expect(s.late).toBe(1); // l'échéance du 06/11 (aujourd'hui) n'est pas en retard
    expect(s.nextDue).toBe('2026-10-30');
    expect(s.myCollectDate).toBe('2026-11-06');
    expect(s.daysToCollect).toBe(0);
    expect(s.endDate).toBe('2026-11-13');
  });

  it('cotisation partielle non comptée, fin de tontine', () => {
    expect(tontineStatus(t, [pay('2026-10-16', 1500)], '2026-10-20').paidCount).toBe(0);
    const all = ['10-16', '10-23', '10-30', '11-06', '11-13'].map((d) => pay(`2026-${d}`));
    const done = tontineStatus(t, [...all, tx({ type: 'revenu', amount: 10000, tontineId: 'to1', categoryId: CAT_TONTINE_RAMASSAGE })], '2026-11-20');
    expect(done.nextDue).toBeNull();
    expect(done.finished).toBe(true);
    expect(upcomingPayments([t], all, '2026-11-20')).toHaveLength(0);
  });

  it('retard le lendemain de l’échéance', () => {
    expect(tontineStatus(t, [], '2026-10-16').late).toBe(0);
    expect(tontineStatus(t, [], '2026-10-17').late).toBe(1);
  });

  it('mensuelle', () => {
    const m = { ...t, frequency: 'mois' as const, startDate: '2026-01-31', myTurn: 2 };
    expect(tontineStatus(m, [], '2026-01-31').myCollectDate).toBe('2026-02-28');
  });
});

describe('objectifs', () => {
  it('progression et montant mensuel', () => {
    const g = { id: 'g1', name: 'Téléphone', icon: 'phone', target: 60000, deadline: '2027-01-15', archived: false, createdAt: 1 };
    const s = goalStatus(g, [tx({ type: 'epargne', amount: 15000, goalId: 'g1', categoryId: null })], DEFAULT_PERIOD, '2026-11-06');
    expect(s.saved).toBe(15000);
    expect(s.remaining).toBe(45000);
    expect(s.ratio).toBe(0.25);
    expect(s.perPeriod).toBe(15000); // nov, déc, jan
    const w = goalStatus(g, [], { ...DEFAULT_PERIOD, kind: 'semaine' }, '2026-11-06');
    expect(w.perPeriod).toBe(Math.ceil(60000 / 11)); // semaines du 2/11 au 11/01 incluse
    expect(s.reached).toBe(false);
  });
});
