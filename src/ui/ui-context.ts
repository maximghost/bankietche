import { createContext } from 'preact';
import { useContext } from 'preact/hooks';
import type { Period } from '../domain/period';
import type { Category, CategoryKind, Goal, Tontine } from '../domain/types';
import type { TxDraft } from './forms/TransactionForm';

export type Tab = 'home' | 'history' | 'savings' | 'stats';

export type SheetState =
  | { kind: 'tx'; draft?: TxDraft }
  | { kind: 'goal'; goal?: Goal }
  | { kind: 'tontine'; tontine?: Tontine }
  | { kind: 'category'; category?: Category; catKind?: CategoryKind };

export interface UI {
  tab: Tab;
  setTab(t: Tab): void;
  open(s: SheetState): void;
  openSettings(): void;
  /** Période affichée (partagée entre Accueil, Opérations et Stats). */
  period: Period;
  isCurrent: boolean;
  canNext: boolean;
  shift(delta: number): void;
  backToCurrent(): void;
  periodLabel: string;
  periodSub: string;
  today: string;
}

export const UICtx = createContext<UI | null>(null);

export function useUI(): UI {
  const ui = useContext(UICtx);
  if (!ui) throw new Error('useUI hors de <UICtx.Provider>');
  return ui;
}
