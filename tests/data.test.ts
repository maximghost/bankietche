import { beforeEach, describe, expect, it } from 'vitest';
import { buildBackup, parseBackup, BackupError } from '../src/data/backup';
import { openDB } from 'idb';
import { deleteWithLinkedTransactions, getDB, loadAll, putRecord, replaceAll, resetDBConnection } from '../src/data/db';
import { buildCsv } from '../src/data/csv';
import { defaultSettings } from '../src/domain/defaults';
import { codeBody, formatCodeBody, normalizeCode, isWellFormed } from '../src/services/licence';

beforeEach(async () => {
  await resetDBConnection();
  await new Promise<void>((res) => {
    const r = indexedDB.deleteDatabase('bankietche');
    r.onsuccess = r.onerror = r.onblocked = () => res();
  });
});

describe('IndexedDB', () => {
  it('crée les catégories par défaut au premier lancement', async () => {
    const d = await loadAll();
    expect(d.categories.length).toBeGreaterThan(10);
    expect(d.transactions).toEqual([]);
  });

  it('supprime un objectif avec ses versements', async () => {
    await getDB();
    await putRecord('goals', { id: 'g1', name: 'X', icon: 'target', target: 100, archived: false, createdAt: 1 });
    await putRecord('transactions', { id: 'a', type: 'epargne', amount: 50, categoryId: null, method: 'mtn', date: '2026-11-01', goalId: 'g1', createdAt: 1 });
    await putRecord('transactions', { id: 'b', type: 'depense', amount: 50, categoryId: 'dep-autre', method: 'mtn', date: '2026-11-01', createdAt: 2 });
    await deleteWithLinkedTransactions('goals', 'g1');
    const d = await loadAll();
    expect(d.goals).toEqual([]);
    expect(d.transactions.map((t) => t.id)).toEqual(['b']);
  });

  it('sauvegarde -> restauration aller-retour', async () => {
    await putRecord('transactions', { id: 'a', type: 'revenu', amount: 7000, categoryId: 'rev-parents', method: 'moov', date: '2026-11-02', createdAt: 5 });
    const original = await loadAll();
    const file = JSON.stringify(buildBackup(original, { ...defaultSettings(), name: 'Maxim' }));
    await replaceAll({ transactions: [], categories: [], tontines: [], goals: [] });
    expect((await loadAll()).categories).toEqual([]);
    const parsed = parseBackup(file);
    expect(parsed.settings?.name).toBe('Maxim');
    await replaceAll(parsed.data);
    expect(await loadAll()).toEqual(original);
  });

  it('migre une base v1.0 (émojis) vers v1.1 (icônes) sans perte', async () => {
    await resetDBConnection();
    const v1 = await openDB('bankietche', 1, {
      upgrade(db) {
        db.createObjectStore('transactions', { keyPath: 'id' }).createIndex('by_date', 'date');
        db.createObjectStore('categories', { keyPath: 'id' });
        db.createObjectStore('tontines', { keyPath: 'id' });
        db.createObjectStore('goals', { keyPath: 'id' });
        db.createObjectStore('meta');
      },
    });
    await v1.put('categories', { id: 'dep-nourriture', name: 'Nourriture', emoji: '🍛', kind: 'depense', budget: 9000, archived: false, system: false, order: 0 });
    await v1.put('categories', { id: 'perso', name: 'Perso', emoji: '🦄', kind: 'depense', budget: 0, archived: false, system: false, order: 1 });
    await v1.put('goals', { id: 'g', name: 'Tel', emoji: '📱', target: 1000, archived: false, createdAt: 1 });
    await v1.put('transactions', { id: 't', type: 'depense', amount: 500, categoryId: 'dep-nourriture', method: 'mtn', date: '2026-11-01', createdAt: 1 });
    v1.close();

    const d = await loadAll();
    const food = d.categories.find((c) => c.id === 'dep-nourriture')!;
    expect(food.icon).toBe('food');
    expect(food.budget).toBe(9000);
    expect('emoji' in food).toBe(false);
    expect(d.categories.find((c) => c.id === 'perso')!.icon).toBe('tag');
    expect(d.categories.some((c) => c.id === 'rev-solde-depart')).toBe(true);
    expect(d.goals[0].icon).toBe('phone');
    expect(d.transactions).toHaveLength(1);
  });

  it('exporte un CSV compatible Excel', async () => {
    await putRecord('transactions', { id: 'a', type: 'depense', amount: 1500, categoryId: 'dep-transport', method: 'especes', date: '2026-11-02', note: 'zém; campus', createdAt: 1 });
    const csv = buildCsv(await loadAll());
    expect(csv.startsWith('\uFEFFDate;Type;')).toBe(true);
    expect(csv).toContain('2026-11-02;Dépense;Transport;-1500;Espèces;;;"zém; campus"');
  });
});

describe('validation des sauvegardes', () => {
  it('rejette les fichiers invalides avec un message clair', () => {
    expect(() => parseBackup('pas du json')).toThrow(BackupError);
    expect(() => parseBackup('{"app":"autre"}')).toThrow(/pas une sauvegarde/);
    expect(() => parseBackup('{"app":"bankietche","schema":99,"data":{}}')).toThrow(/plus récente/);
    const bad = buildBackup({ transactions: [{ id: 'x', type: 'depense', amount: -5 } as never], categories: [], tontines: [], goals: [] }, defaultSettings());
    expect(() => parseBackup(JSON.stringify(bad))).toThrow(/opérations/);
  });
});

describe('sauvegardes v1.0', () => {
  it('convertit les émojis d’une sauvegarde v1', () => {
    const v1 = { app: 'bankietche', schema: 1, exportedAt: '', data: {
      transactions: [], tontines: [],
      categories: [{ id: 'c', name: 'N', emoji: '🛵', kind: 'depense', budget: 0, archived: false, system: false, order: 0 }],
      goals: [{ id: 'g', name: 'G', emoji: '🎓', target: 10, archived: false, createdAt: 1 }],
    } };
    const b = parseBackup(JSON.stringify(v1));
    expect(b.data.categories[0].icon).toBe('moto');
    expect(b.data.goals[0].icon).toBe('graduation');
    expect(b.settings).toBeUndefined();
  });
});

describe('codes de licence', () => {
  it('normalise les saisies', () => {
    expect(normalizeCode('bkt 7k2m qx9p')).toBe('BKT-7K2M-QX9P');
    expect(normalizeCode('7k2m-qx9p')).toBe('BKT-7K2M-QX9P');
    expect(codeBody('BKTX-QW23')).toBe('BKTXQW23'); // corps commençant par BKT conservé
    expect(codeBody('BKT-BKTX-QW23')).toBe('BKTXQW23');
    expect(formatCodeBody('7K2MQ')).toBe('7K2M-Q');
    expect(isWellFormed('BKT-7K2M-QX9P')).toBe(true);
    expect(isWellFormed('BKT-7K2M-QX0P')).toBe(false); // 0 exclu de l'alphabet
  });
});
