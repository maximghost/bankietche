import { readFileSync, writeFileSync } from 'node:fs';
import { describe, expect, it, vi } from 'vitest';
import { CAT_TONTINE_COTISATION, defaultCategories, defaultSettings } from '../src/domain/defaults';
import { periodAt } from '../src/domain/period';
import type { AppData, Transaction } from '../src/domain/types';
import { renderReportPdf } from '../src/export/pdf';
import { buildReport, recentPeriods, reportFileName } from '../src/export/report';

let n = 0;
const tx = (p: Partial<Transaction>): Transaction => ({
  id: `t${++n}`, type: 'depense', amount: 1000, categoryId: 'dep-nourriture', method: 'mtn', date: '2026-11-03', createdAt: n, ...p,
});

function sample(): AppData {
  const categories = defaultCategories().map((c) => ({
    ...c, budget: ({ 'dep-nourriture': 7000, 'dep-transport': 3000, 'dep-forfait': 1500, 'dep-sorties': 2000 } as Record<string, number>)[c.id] ?? 0,
  }));
  const ops: Partial<Transaction>[] = [
    { type: 'revenu', amount: 25000, categoryId: 'rev-solde-depart', note: 'Solde de départ', date: '2026-11-02' },
    { amount: 1500, categoryId: 'dep-transport', method: 'especes', note: 'zém campus', date: '2026-11-02' },
    { amount: 4000, categoryId: 'dep-nourriture', date: '2026-11-03' },
    { amount: 1000, categoryId: 'dep-forfait', note: 'pass 1 Go', date: '2026-11-03' },
    { type: 'revenu', amount: 10000, categoryId: 'rev-business', method: 'moov', note: 'vente de pagnes au marché Dantokpa', date: '2026-11-04' },
    { amount: 2500, categoryId: 'dep-sorties', method: 'moov', date: '2026-11-05' },
    { amount: 2000, categoryId: CAT_TONTINE_COTISATION, tontineId: 'to', method: 'mtn', date: '2026-11-06' },
    { type: 'epargne', amount: 5000, categoryId: null, goalId: 'g1', date: '2026-11-06' },
    { amount: 3500, categoryId: 'dep-nourriture', method: 'celtiis', note: 'courses', date: '2026-11-06' },
  ];
  for (let i = 0; i < 30; i++) ops.push({ amount: 200 + i * 50, categoryId: i % 2 ? 'dep-transport' : 'dep-nourriture', method: i % 3 ? 'especes' : 'mtn', note: `petite dépense ${i + 1}`, date: '2026-11-07' });
  return {
    categories,
    transactions: ops.map(tx),
    goals: [{ id: 'g1', name: 'Nouveau téléphone', icon: 'phone', target: 60000, deadline: '2027-02-28', archived: false, createdAt: 1 }],
    tontines: [{ id: 'to', name: 'Tontine des amis de la fac', amount: 2000, frequency: 'semaine', startDate: '2026-10-23', members: 6, myTurn: 3, archived: false, createdAt: 1 }],
  };
}

describe('relevé PDF', () => {
  const settings = { ...defaultSettings(), name: 'Maxim', period: { ...defaultSettings().period, kind: 'semaine' as const } };

  it('propose les 12 dernières périodes', () => {
    const p = recentPeriods(settings, '2026-11-06');
    expect(p).toHaveLength(12);
    expect(p[0].label).toBe('2 – 8 nov. (en cours)');
    expect(p[1].label).toBe('26 oct. – 1 nov.');
  });

  it('calcule le contenu et génère un PDF paginé', async () => {
    const period = periodAt(settings.period, '2026-11-06');
    const report = buildReport(sample(), settings, period, '2026-11-07', new Date(2026, 10, 7, 17, 5));
    expect(report.rows).toHaveLength(39);
    expect(report.rows[0].label).toBe('Solde de départ');
    expect(report.rows.find((r) => r.type === 'epargne')!.label).toBe('Épargne · Nouveau téléphone');
    expect(reportFileName(report)).toBe('Bankietche-releve-2026-11-02_au_2026-11-08.pdf');

    // Le logo est lu depuis le dossier public (fetch simulé hors navigateur).
    vi.stubGlobal('fetch', async () => new Response(readFileSync('public/icons/icon-192.png')));
    const blob = await renderReportPdf(report);
    vi.unstubAllGlobals();
    const bytes = Buffer.from(await blob.arrayBuffer());
    expect(bytes.subarray(0, 5).toString()).toBe('%PDF-');
    const pages = (bytes.toString('latin1').match(/\/Type \/Page\b/g) ?? []).length;
    expect(pages).toBeGreaterThanOrEqual(2);
    writeFileSync('/tmp/releve-test.pdf', bytes);
  });
});
