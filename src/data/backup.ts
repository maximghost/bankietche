import { iconFromEmoji } from '../domain/defaults';
import type {
  AppData, Category, Frequency, Goal, PaymentMethod, Settings, Tontine, Transaction, TxType,
} from '../domain/types';
import { normalizeSettings } from './db';

/**
 * Format de sauvegarde. Incrémenter SCHEMA en cas de changement incompatible
 * et ajouter la conversion correspondante dans parseBackup().
 */
export const BACKUP_SCHEMA = 2;

export interface BackupFile {
  app: 'bankietche';
  schema: number;
  exportedAt: string;
  data: AppData;
  /** Absent des sauvegardes v1 : les réglages actuels sont alors conservés. */
  settings?: Settings;
}

export function buildBackup(data: AppData, settings: Settings, now: Date = new Date()): BackupFile {
  return { app: 'bankietche', schema: BACKUP_SCHEMA, exportedAt: now.toISOString(), data, settings };
}

export function backupFileName(now: Date = new Date()): string {
  const d = now.toISOString().slice(0, 10);
  return `bankietche-sauvegarde-${d}.json`;
}

export class BackupError extends Error {}

const TX_TYPES: TxType[] = ['depense', 'revenu', 'epargne'];
const METHODS: PaymentMethod[] = ['mtn', 'moov', 'celtiis', 'especes', 'banque', 'autre'];
const FREQS: Frequency[] = ['jour', 'semaine', 'mois'];
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

const isStr = (v: unknown): v is string => typeof v === 'string';
const isInt = (v: unknown): v is number => typeof v === 'number' && Number.isSafeInteger(v);
const isObj = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null;

function checkArray<T>(v: unknown, name: string, check: (x: Record<string, unknown>) => boolean): T[] {
  if (!Array.isArray(v)) throw new BackupError(`Section « ${name} » manquante ou invalide.`);
  v.forEach((x, i) => {
    if (!isObj(x) || !check(x)) throw new BackupError(`Élément n° ${i + 1} invalide dans « ${name} ».`);
  });
  return v as T[];
}

/** Lit et valide un fichier de sauvegarde. Lève BackupError avec un message lisible. */
export function parseBackup(text: string): BackupFile {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    throw new BackupError("Ce fichier n'est pas une sauvegarde Bankiétché lisible.");
  }
  if (!isObj(raw) || raw.app !== 'bankietche') {
    throw new BackupError("Ce fichier n'est pas une sauvegarde Bankiétché.");
  }
  if (!isInt(raw.schema) || raw.schema > BACKUP_SCHEMA) {
    throw new BackupError("Cette sauvegarde vient d'une version plus récente de l'appli. Mets à jour Bankiétché.");
  }
  const d = raw.data;
  if (!isObj(d)) throw new BackupError('Sauvegarde incomplète.');

  // Schéma 1 (v1.0) : émojis -> icônes.
  if (raw.schema === 1) {
    for (const key of ['categories', 'goals'] as const) {
      const arr = d[key];
      if (Array.isArray(arr)) {
        d[key] = arr.map((x) => {
          if (!isObj(x) || isStr(x.icon)) return x;
          const { emoji, ...rest } = x;
          return { ...rest, icon: iconFromEmoji(emoji, key === 'goals' ? 'target' : 'tag') };
        });
      }
    }
  }

  const transactions = checkArray<Transaction>(d.transactions, 'opérations', (x) =>
    isStr(x.id) && TX_TYPES.includes(x.type as TxType) && isInt(x.amount) && (x.amount as number) > 0 &&
    (x.categoryId === null || isStr(x.categoryId)) && METHODS.includes(x.method as PaymentMethod) &&
    isStr(x.date) && DATE_RE.test(x.date) && isInt(x.createdAt));

  const categories = checkArray<Category>(d.categories, 'catégories', (x) =>
    isStr(x.id) && isStr(x.name) && isStr(x.icon) && (x.kind === 'depense' || x.kind === 'revenu') &&
    isInt(x.budget) && typeof x.archived === 'boolean' && typeof x.system === 'boolean' && isInt(x.order));

  const tontines = checkArray<Tontine>(d.tontines, 'tontines', (x) =>
    isStr(x.id) && isStr(x.name) && isInt(x.amount) && FREQS.includes(x.frequency as Frequency) &&
    isStr(x.startDate) && DATE_RE.test(x.startDate) && isInt(x.members) && isInt(x.myTurn) &&
    typeof x.archived === 'boolean' && isInt(x.createdAt));

  const goals = checkArray<Goal>(d.goals, 'objectifs', (x) =>
    isStr(x.id) && isStr(x.name) && isStr(x.icon) && isInt(x.target) &&
    (x.deadline === undefined || (isStr(x.deadline) && DATE_RE.test(x.deadline))) &&
    typeof x.archived === 'boolean' && isInt(x.createdAt));

  return {
    app: 'bankietche',
    schema: raw.schema,
    exportedAt: isStr(raw.exportedAt) ? raw.exportedAt : '',
    data: { transactions, categories, tontines, goals },
    settings: raw.schema >= 2 && isObj(raw.settings) ? normalizeSettings(raw.settings as Partial<Settings>) : undefined,
  };
}

/** Déclenche le téléchargement (ou le partage sur mobile si disponible). */
export async function shareOrDownload(backup: BackupFile, now: Date = new Date()) {
  const name = backupFileName(now);
  const blob = new Blob([JSON.stringify(backup)], { type: 'application/json' });
  const file = new File([blob], name, { type: 'application/json' });

  // Sur Android, le partage permet d'envoyer directement sur WhatsApp, Drive, e-mail…
  const nav = navigator as Navigator & { canShare?: (d: ShareData) => boolean };
  if (nav.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ files: [file], title: 'Sauvegarde Bankiétché' });
      return 'shared' as const;
    } catch (e) {
      if ((e as DOMException).name === 'AbortError') return 'cancelled' as const;
      // sinon : repli sur le téléchargement
    }
  }
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  return 'downloaded' as const;
}
