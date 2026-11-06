import { describe, expect, it } from 'vitest';
import { CAT_TONTINE_COTISATION, defaultCategories, defaultSettings } from '../src/domain/defaults';
import { buildDailyNotification } from '../src/domain/notify';
import type { AppData, Settings, Transaction } from '../src/domain/types';

let n = 0;
const tx = (p: Partial<Transaction>): Transaction => ({
  id: `t${++n}`, type: 'depense', amount: 1000, categoryId: 'dep-nourriture', method: 'mtn', date: '2026-11-06', createdAt: n, ...p,
});
const settings = (p: Partial<Settings> = {}): Settings => ({ ...defaultSettings(), name: 'Maxim', onboarded: true, ...p });
const data = (p: Partial<AppData> = {}): AppData => ({ transactions: [], categories: defaultCategories(), tontines: [], goals: [], ...p });
const TODAY = '2026-11-06';
const general = settings();
const detailed = settings({ notifications: { enabled: true, hour: 20, detailed: true } });

/** Aucun montant, aucun prénom : vérifie que le texte général ne divulgue rien. */
const leaks = (s: string) => /\d[\d  ]*F\b/.test(s) || s.includes('Maxim');

describe('notification quotidienne', () => {
  it('sans données : invitation à commencer', () => {
    expect(buildDailyNotification({ data: data(), settings: general, todayISO: TODAY, lastBackupAt: null }).kind).toBe('welcome');
  });

  const tontine = { id: 'to', name: 'Tontine des amis', amount: 2000, frequency: 'semaine' as const, startDate: '2026-10-23', members: 6, myTurn: 3, archived: false, createdAt: 1 };

  it('cotisation en retard : message général sans détails, détaillé si demandé', () => {
    const d = data({ tontines: [tontine], transactions: [tx({ type: 'revenu', amount: 50000, categoryId: 'rev-parents' })] });
    const g = buildDailyNotification({ data: d, settings: general, todayISO: TODAY, lastBackupAt: null });
    expect(g.kind).toBe('tontine-late');
    expect(g.body).not.toContain('Tontine des amis');
    expect(leaks(g.title + g.body)).toBe(false);
    const det = buildDailyNotification({ data: d, settings: detailed, todayISO: TODAY, lastBackupAt: null });
    expect(det.body).toContain('« Tontine des amis »');
    expect(det.body.startsWith('Maxim,')).toBe(true);
  });

  it('le mode discret force toujours le message général', () => {
    const d = data({ tontines: [tontine], transactions: [tx({ type: 'revenu', amount: 50000, categoryId: 'rev-parents' })] });
    const m = buildDailyNotification({ data: d, settings: { ...detailed, discreet: true }, todayISO: TODAY, lastBackupAt: null });
    expect(m.body).not.toContain('Tontine des amis');
  });

  it('cotisation demain', () => {
    const t = { ...tontine, startDate: '2026-11-07' };
    const d = data({ tontines: [t], transactions: [tx({ type: 'revenu', amount: 1, categoryId: 'rev-parents' })] });
    const m = buildDailyNotification({ data: d, settings: detailed, todayISO: TODAY, lastBackupAt: null });
    expect(m.kind).toBe('tontine-soon');
    expect(m.title).toBe('Cotisation demain');
    expect(m.body).toContain('2 000 F');
  });

  const cats = defaultCategories().map((c) => (c.id === 'dep-nourriture' ? { ...c, budget: 10000 } : c.id === 'dep-transport' ? { ...c, budget: 10000 } : c));

  it('budget dépassé', () => {
    const d = data({ categories: cats, transactions: [tx({ amount: 25000, date: '2026-11-02' })] });
    const g = buildDailyNotification({ data: d, settings: general, todayISO: TODAY, lastBackupAt: null });
    expect(g.kind).toBe('budget-over');
    expect(leaks(g.title + g.body)).toBe(false);
    const det = buildDailyNotification({ data: d, settings: detailed, todayISO: TODAY, lastBackupAt: null });
    expect(det.body).toContain('5 000 F');
  });

  it('catégorie épuisée sans dépassement global', () => {
    const d = data({ categories: cats, transactions: [tx({ amount: 10000, date: '2026-11-02' })] });
    const m = buildDailyNotification({ data: d, settings: detailed, todayISO: TODAY, lastBackupAt: null });
    expect(m.kind).toBe('category-over');
    expect(m.body).toContain('Nourriture : 100 %');
  });

  it('rien noté aujourd’hui, puis tout est à jour', () => {
    const d = data({ transactions: [tx({ type: 'revenu', amount: 5000, categoryId: 'rev-parents', date: '2026-11-05' })] });
    expect(buildDailyNotification({ data: d, settings: general, todayISO: TODAY, lastBackupAt: null }).kind).toBe('no-entry');
    const d2 = data({ transactions: [tx({ type: 'revenu', amount: 5000, categoryId: 'rev-parents' })] });
    expect(buildDailyNotification({ data: d2, settings: general, todayISO: TODAY, lastBackupAt: TODAY }).kind).toBe('nudge');
  });

  it('dernier jour de la période', () => {
    const d = data({ transactions: [tx({ type: 'revenu', amount: 5000, categoryId: 'rev-parents', date: '2026-11-30' })] });
    expect(buildDailyNotification({ data: d, settings: general, todayISO: '2026-11-30', lastBackupAt: '2026-11-30' }).kind).toBe('last-day');
  });

  it('rappel de sauvegarde', () => {
    const txs = Array.from({ length: 5 }, () => tx({ type: 'revenu', amount: 100, categoryId: 'rev-parents' }));
    expect(buildDailyNotification({ data: data({ transactions: txs }), settings: general, todayISO: TODAY, lastBackupAt: null }).kind).toBe('backup');
  });

  it('les cotisations payées ne déclenchent pas de retard', () => {
    const paid = ['2026-10-23', '2026-10-30', '2026-11-06'].map((date) => tx({ amount: 2000, date, tontineId: 'to', categoryId: CAT_TONTINE_COTISATION }));
    const m = buildDailyNotification({ data: data({ tontines: [tontine], transactions: paid }), settings: general, todayISO: TODAY, lastBackupAt: TODAY });
    expect(m.kind).not.toBe('tontine-late');
  });
});
