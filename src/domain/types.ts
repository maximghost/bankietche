/** Modèle de données de Bankiétché. Montants : entiers en francs CFA. Dates : 'YYYY-MM-DD' (heure locale). */

export type TxType = 'depense' | 'revenu' | 'epargne';

export type PaymentMethod = 'mtn' | 'moov' | 'celtiis' | 'especes' | 'banque' | 'autre';

export interface Transaction {
  id: string;
  type: TxType;
  amount: number;
  /** Catégorie (dépense ou revenu). Null pour l'épargne. */
  categoryId: string | null;
  method: PaymentMethod;
  date: string;
  note?: string;
  /** Renseigné pour un versement vers un objectif d'épargne. */
  goalId?: string;
  /** Renseigné pour une cotisation ou un ramassage de tontine. */
  tontineId?: string;
  createdAt: number;
}

export type CategoryKind = 'depense' | 'revenu';

export interface Category {
  id: string;
  name: string;
  /** Clé d'icône (voir ui/icon-registry.tsx). */
  icon: string;
  kind: CategoryKind;
  /** Budget mensuel (dépenses uniquement). 0 = pas de budget. */
  budget: number;
  archived: boolean;
  /** Catégorie système (non supprimable, ex. tontine). */
  system: boolean;
  order: number;
}

export type Frequency = 'jour' | 'semaine' | 'mois';

export interface Tontine {
  id: string;
  name: string;
  /** Montant d'une cotisation. */
  amount: number;
  frequency: Frequency;
  /** Date de la première cotisation. */
  startDate: string;
  /** Nombre de participants (= nombre de tours). */
  members: number;
  /** Mon rang de ramassage (1 = premier tour). */
  myTurn: number;
  archived: boolean;
  createdAt: number;
}

export interface Goal {
  id: string;
  name: string;
  /** Clé d'icône (voir ui/icon-registry.tsx). */
  icon: string;
  target: number;
  deadline?: string;
  archived: boolean;
  createdAt: number;
}

export type Theme = 'system' | 'light' | 'dark';

/** Réglages de l'utilisateur (stockés localement). */
export interface Settings {
  /** Prénom ou pseudo, pour personnaliser les messages. */
  name: string;
  period: import('./period').PeriodConfig;
  theme: Theme;
  /** Mode discret : masque les montants à l'écran. */
  discreet: boolean;
  /** Assistant de premier lancement terminé. */
  onboarded: boolean;
  /** Version des CGU acceptées et date d'acceptation. */
  termsVersion?: string;
  termsAcceptedAt?: string;
}

export interface AppData {
  transactions: Transaction[];
  categories: Category[];
  tontines: Tontine[];
  goals: Goal[];
}

export const PAYMENT_METHODS: { id: PaymentMethod; label: string; short: string; color: string }[] = [
  { id: 'mtn', label: 'MTN MoMo', short: 'MoMo', color: '#FFCB05' },
  { id: 'moov', label: 'Moov Money', short: 'Moov', color: '#0066B3' },
  { id: 'celtiis', label: 'Celtiis Cash', short: 'Celtiis', color: '#E30613' },
  { id: 'especes', label: 'Espèces', short: 'Espèces', color: '#16A34A' },
  { id: 'banque', label: 'Banque / carte', short: 'Banque', color: '#475569' },
  { id: 'autre', label: 'Autre', short: 'Autre', color: '#94A3B8' },
];

export const FREQUENCY_LABELS: Record<Frequency, string> = {
  jour: 'Chaque jour',
  semaine: 'Chaque semaine',
  mois: 'Chaque mois',
};
