import { openDB, type DBSchema, type IDBPDatabase, type IDBPTransaction, type StoreNames } from 'idb';
import { CAT_SOLDE_DEPART, defaultCategories, defaultSettings, iconFromEmoji } from '../domain/defaults';
import { sanitizePeriodConfig } from '../domain/period';
import type { AppData, Category, Goal, Settings, Tontine, Transaction } from '../domain/types';

/**
 * Stockage local (IndexedDB). Toutes les données restent sur le téléphone.
 * Pour faire évoluer le schéma : incrémenter DB_VERSION et ajouter un bloc
 * `if (oldVersion < N)` dans upgrade() — ne jamais modifier un bloc existant.
 */
const DB_NAME = 'bankietche';
const DB_VERSION = 2;

interface BankietcheDB extends DBSchema {
  transactions: { key: string; value: Transaction; indexes: { by_date: string } };
  categories: { key: string; value: Category };
  tontines: { key: string; value: Tontine };
  goals: { key: string; value: Goal };
  meta: { key: string; value: unknown };
}

export type StoreName = 'transactions' | 'categories' | 'tontines' | 'goals';

let dbPromise: Promise<IDBPDatabase<BankietcheDB>> | null = null;

export function getDB(): Promise<IDBPDatabase<BankietcheDB>> {
  if (!dbPromise) {
    dbPromise = openDB<BankietcheDB>(DB_NAME, DB_VERSION, {
      upgrade(db, oldVersion, _newVersion, tx) {
        if (oldVersion < 1) {
          const txStore = db.createObjectStore('transactions', { keyPath: 'id' });
          txStore.createIndex('by_date', 'date');
          db.createObjectStore('categories', { keyPath: 'id' });
          db.createObjectStore('tontines', { keyPath: 'id' });
          db.createObjectStore('goals', { keyPath: 'id' });
          db.createObjectStore('meta');
          const cats = tx.objectStore('categories');
          for (const c of defaultCategories()) void cats.put(c);
        }
        if (oldVersion >= 1 && oldVersion < 2) {
          // v1.0 -> v1.1 : émojis remplacés par des icônes, nouvelle catégorie « Solde de départ ».
          void migrateV1toV2(tx);
        }
      },
    });
  }
  return dbPromise;
}

type UpgradeTx = IDBPTransaction<BankietcheDB, StoreNames<BankietcheDB>[], 'versionchange'>;

async function migrateV1toV2(tx: UpgradeTx) {
  const cats = tx.objectStore('categories');
  let c = await cats.openCursor();
  let maxOrder = 0;
  while (c) {
    const v = c.value as Category & { emoji?: string };
    maxOrder = Math.max(maxOrder, v.order);
    if (!v.icon) {
      const { emoji, ...rest } = v;
      await c.update({ ...rest, icon: iconFromEmoji(emoji, 'tag') });
    }
    c = await c.continue();
  }
  if (!(await cats.get(CAT_SOLDE_DEPART))) {
    const seed = defaultCategories().find((x) => x.id === CAT_SOLDE_DEPART)!;
    await cats.put({ ...seed, order: maxOrder + 1 });
  }
  const goals = tx.objectStore('goals');
  let g = await goals.openCursor();
  while (g) {
    const v = g.value as Goal & { emoji?: string };
    if (!v.icon) {
      const { emoji, ...rest } = v;
      await g.update({ ...rest, icon: iconFromEmoji(emoji, 'target') });
    }
    g = await g.continue();
  }
}

/** Ferme et réinitialise la connexion (utilisé par les tests). */
export async function resetDBConnection() {
  if (dbPromise) (await dbPromise).close();
  dbPromise = null;
}

export async function loadAll(): Promise<AppData> {
  const db = await getDB();
  const [transactions, categories, tontines, goals] = await Promise.all([
    db.getAll('transactions'),
    db.getAll('categories'),
    db.getAll('tontines'),
    db.getAll('goals'),
  ]);
  transactions.sort((a, b) => (a.date === b.date ? b.createdAt - a.createdAt : a.date < b.date ? 1 : -1));
  categories.sort((a, b) => a.order - b.order);
  tontines.sort((a, b) => a.createdAt - b.createdAt);
  goals.sort((a, b) => a.createdAt - b.createdAt);
  return { transactions, categories, tontines, goals };
}

export async function putRecord<S extends StoreName>(store: S, value: BankietcheDB[S]['value']) {
  const db = await getDB();
  await db.put(store, value as never);
}

export async function deleteRecord(store: StoreName, id: string) {
  const db = await getDB();
  await db.delete(store, id);
}

/** Supprime un objectif ou une tontine ET les opérations qui y sont liées, en une transaction. */
export async function deleteWithLinkedTransactions(store: 'goals' | 'tontines', id: string) {
  const db = await getDB();
  const tx = db.transaction([store, 'transactions'], 'readwrite');
  const key = store === 'goals' ? 'goalId' : 'tontineId';
  let cursor = await tx.objectStore('transactions').openCursor();
  while (cursor) {
    if (cursor.value[key] === id) await cursor.delete();
    cursor = await cursor.continue();
  }
  await tx.objectStore(store).delete(id);
  await tx.done;
}

/** Remplace TOUTES les données (restauration d'une sauvegarde), de façon atomique. */
export async function replaceAll(data: AppData) {
  const db = await getDB();
  const stores: StoreName[] = ['transactions', 'categories', 'tontines', 'goals'];
  const tx = db.transaction(stores, 'readwrite');
  await Promise.all(stores.map((s) => tx.objectStore(s).clear()));
  for (const s of stores) {
    const os = tx.objectStore(s);
    for (const v of data[s]) await os.put(v as never);
  }
  await tx.done;
}

export async function getMeta<T>(key: string): Promise<T | undefined> {
  const db = await getDB();
  return (await db.get('meta', key)) as T | undefined;
}

export async function setMeta(key: string, value: unknown) {
  const db = await getDB();
  await db.put('meta', value, key);
}

const SETTINGS_KEY = 'settings';

export async function loadSettings(): Promise<Settings> {
  const raw = await getMeta<Partial<Settings>>(SETTINGS_KEY);
  return normalizeSettings(raw);
}

export function normalizeSettings(raw: Partial<Settings> | undefined): Settings {
  const d = defaultSettings();
  if (!raw) return d;
  return {
    name: typeof raw.name === 'string' ? raw.name.slice(0, 30) : d.name,
    period: sanitizePeriodConfig(raw.period),
    theme: raw.theme === 'light' || raw.theme === 'dark' || raw.theme === 'system' ? raw.theme : d.theme,
    discreet: raw.discreet === true,
    onboarded: raw.onboarded === true,
    termsVersion: typeof raw.termsVersion === 'string' ? raw.termsVersion : undefined,
    termsAcceptedAt: typeof raw.termsAcceptedAt === 'string' ? raw.termsAcceptedAt : undefined,
  };
}

export async function saveSettings(s: Settings) {
  await setMeta(SETTINGS_KEY, s);
}

/** Efface toutes les données financières et les réglages (la licence est conservée). */
export async function wipeAllData() {
  const db = await getDB();
  const stores: StoreName[] = ['transactions', 'categories', 'tontines', 'goals'];
  const tx = db.transaction(['transactions', 'categories', 'tontines', 'goals', 'meta'], 'readwrite');
  for (const st of stores) await tx.objectStore(st).clear();
  for (const c of defaultCategories()) await tx.objectStore('categories').put(c);
  await tx.objectStore('meta').delete(SETTINGS_KEY);
  await tx.objectStore('meta').delete('lastBackupAt');
  await tx.done;
}

export function newId(): string {
  return crypto.randomUUID();
}
