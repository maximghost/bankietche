import { createContext, type ComponentChildren } from 'preact';
import { useCallback, useContext, useEffect, useMemo, useState } from 'preact/hooks';
import {
  deleteRecord, deleteWithLinkedTransactions, getMeta, loadAll, loadSettings, newId, putRecord,
  replaceAll, saveSettings, setMeta, wipeAllData,
} from '../data/db';
import { defaultSettings } from '../domain/defaults';
import type { AppData, Category, Goal, Settings, Tontine, Transaction } from '../domain/types';

/**
 * État global : toutes les données sont chargées en mémoire (volume faible :
 * quelques milliers d'opérations au plus) et rechargées après chaque écriture.
 */

export type NewTransaction = Omit<Transaction, 'id' | 'createdAt'> & Partial<Pick<Transaction, 'id' | 'createdAt'>>;

interface Store {
  data: AppData;
  settings: Settings;
  ready: boolean;
  lastBackupAt: string | null;
  saveTransaction(t: NewTransaction): Promise<void>;
  deleteTransaction(id: string): Promise<void>;
  saveCategory(c: Omit<Category, 'id' | 'order'> & Partial<Pick<Category, 'id' | 'order'>>): Promise<void>;
  saveCategories(cs: Category[]): Promise<void>;
  saveTontine(t: Omit<Tontine, 'id' | 'createdAt'> & Partial<Pick<Tontine, 'id' | 'createdAt'>>): Promise<void>;
  deleteTontine(id: string): Promise<void>;
  saveGoal(g: Omit<Goal, 'id' | 'createdAt'> & Partial<Pick<Goal, 'id' | 'createdAt'>>): Promise<void>;
  deleteGoal(id: string): Promise<void>;
  updateSettings(patch: Partial<Settings>): Promise<void>;
  restore(data: AppData, settings?: Settings): Promise<void>;
  wipe(): Promise<void>;
  markBackupDone(): Promise<void>;
}

const EMPTY: AppData = { transactions: [], categories: [], tontines: [], goals: [] };
const Ctx = createContext<Store | null>(null);

export function StoreProvider({ children }: { children: ComponentChildren }) {
  const [data, setData] = useState<AppData>(EMPTY);
  const [settings, setSettings] = useState<Settings>(defaultSettings());
  const [ready, setReady] = useState(false);
  const [lastBackupAt, setLastBackupAt] = useState<string | null>(null);

  const reload = useCallback(async () => {
    setData(await loadAll());
  }, []);

  useEffect(() => {
    void (async () => {
      await reload();
      setSettings(await loadSettings());
      setLastBackupAt((await getMeta<string>('lastBackupAt')) ?? null);
      setReady(true);
    })();
  }, [reload]);

  const store = useMemo<Store>(() => ({
    data,
    settings,
    ready,
    lastBackupAt,
    async saveTransaction(t) {
      await putRecord('transactions', { ...t, id: t.id ?? newId(), createdAt: t.createdAt ?? Date.now() });
      await reload();
    },
    async deleteTransaction(id) {
      await deleteRecord('transactions', id);
      await reload();
    },
    async saveCategory(c) {
      const order = c.order ?? data.categories.reduce((m, x) => Math.max(m, x.order), -1) + 1;
      await putRecord('categories', { ...c, id: c.id ?? newId(), order });
      await reload();
    },
    async saveCategories(cs) {
      for (const c of cs) await putRecord('categories', c);
      await reload();
    },
    async saveTontine(t) {
      await putRecord('tontines', { ...t, id: t.id ?? newId(), createdAt: t.createdAt ?? Date.now() });
      await reload();
    },
    async deleteTontine(id) {
      await deleteWithLinkedTransactions('tontines', id);
      await reload();
    },
    async saveGoal(g) {
      await putRecord('goals', { ...g, id: g.id ?? newId(), createdAt: g.createdAt ?? Date.now() });
      await reload();
    },
    async deleteGoal(id) {
      await deleteWithLinkedTransactions('goals', id);
      await reload();
    },
    async updateSettings(patch) {
      const next = { ...settings, ...patch };
      await saveSettings(next);
      setSettings(next);
    },
    async restore(next, nextSettings) {
      await replaceAll(next);
      if (nextSettings) {
        // On garde l'acceptation des CGU faite sur CET appareil.
        const merged = { ...nextSettings, termsVersion: settings.termsVersion, termsAcceptedAt: settings.termsAcceptedAt, onboarded: true };
        await saveSettings(merged);
        setSettings(merged);
      }
      await reload();
    },
    async wipe() {
      await wipeAllData();
      setSettings({ ...defaultSettings(), termsVersion: settings.termsVersion, termsAcceptedAt: settings.termsAcceptedAt });
      await saveSettings({ ...defaultSettings(), termsVersion: settings.termsVersion, termsAcceptedAt: settings.termsAcceptedAt });
      setLastBackupAt(null);
      await reload();
    },
    async markBackupDone() {
      const now = new Date().toISOString();
      await setMeta('lastBackupAt', now);
      setLastBackupAt(now);
    },
  }), [data, settings, ready, lastBackupAt, reload]);

  return <Ctx.Provider value={store}>{children}</Ctx.Provider>;
}

export function useStore(): Store {
  const s = useContext(Ctx);
  if (!s) throw new Error('useStore doit être utilisé dans <StoreProvider>');
  return s;
}

export function useCategoryMap() {
  const { data } = useStore();
  return useMemo(() => new Map(data.categories.map((c) => [c.id, c])), [data.categories]);
}
