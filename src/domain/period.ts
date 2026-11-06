import { addDays, addMonths, diffDays, parseISODate, toISODate } from './dates';

/**
 * Période de gestion choisie par l'utilisateur.
 * Tout le monde n'est pas payé au mois : un étudiant peut recevoir de l'argent
 * chaque semaine, un commerçant gère au jour le jour, d'autres « d'une
 * rentrée d'argent à la suivante » (période libre).
 */
export type PeriodKind = 'jour' | 'semaine' | 'mois' | 'annee' | 'libre';

export interface PeriodConfig {
  kind: PeriodKind;
  /** Premier jour de la semaine (0 = dimanche, 1 = lundi). */
  weekStart: number;
  /** Jour de début du mois de gestion (1 à 28), ex. 25 si la paie tombe le 25. */
  monthStartDay: number;
  /** Période libre : date de début de la première période. */
  customStart: string;
  /** Période libre : durée en jours (2 à 366). */
  customLength: number;
}

/** Intervalle de dates inclusif. */
export interface Period {
  start: string;
  end: string;
}

export const DEFAULT_PERIOD: PeriodConfig = {
  kind: 'mois',
  weekStart: 1,
  monthStartDay: 1,
  customStart: '2026-01-01',
  customLength: 14,
};

export const PERIOD_KINDS: { kind: PeriodKind; label: string; description: string }[] = [
  { kind: 'jour', label: 'Journalière', description: 'Je gère au jour le jour (petits revenus quotidiens, commerce).' },
  { kind: 'semaine', label: 'Hebdomadaire', description: 'Je reçois ou je planifie mon argent chaque semaine.' },
  { kind: 'mois', label: 'Mensuelle', description: 'Salaire, bourse ou argent reçu chaque mois.' },
  { kind: 'annee', label: 'Annuelle', description: 'Vision sur toute l’année (budget global, projets).' },
  { kind: 'libre', label: 'Libre', description: 'Une durée sur mesure, ex. 10 jours entre deux rentrées d’argent.' },
];

export function sanitizePeriodConfig(c: Partial<PeriodConfig> | undefined): PeriodConfig {
  const base = { ...DEFAULT_PERIOD, ...(c ?? {}) };
  const kinds: PeriodKind[] = ['jour', 'semaine', 'mois', 'annee', 'libre'];
  return {
    kind: kinds.includes(base.kind) ? base.kind : 'mois',
    weekStart: Number.isInteger(base.weekStart) && base.weekStart >= 0 && base.weekStart <= 6 ? base.weekStart : 1,
    monthStartDay: Number.isInteger(base.monthStartDay) ? Math.min(28, Math.max(1, base.monthStartDay)) : 1,
    customStart: /^\d{4}-\d{2}-\d{2}$/.test(base.customStart) ? base.customStart : DEFAULT_PERIOD.customStart,
    customLength: Number.isInteger(base.customLength) ? Math.min(366, Math.max(2, base.customLength)) : 14,
  };
}

/** Période qui contient la date donnée. */
export function periodAt(cfg: PeriodConfig, date: string): Period {
  const d = parseISODate(date);
  switch (cfg.kind) {
    case 'jour':
      return { start: date, end: date };
    case 'semaine': {
      const offset = (d.getDay() - cfg.weekStart + 7) % 7;
      const start = addDays(date, -offset);
      return { start, end: addDays(start, 6) };
    }
    case 'mois': {
      const day = cfg.monthStartDay;
      let start = toISODate(new Date(d.getFullYear(), d.getMonth(), day));
      if (d.getDate() < day) start = addMonths(start, -1);
      return { start, end: addDays(addMonths(start, 1), -1) };
    }
    case 'annee': {
      const y = d.getFullYear();
      return { start: `${y}-01-01`, end: `${y}-12-31` };
    }
    case 'libre': {
      const len = cfg.customLength;
      const k = Math.floor(diffDays(cfg.customStart, date) / len);
      const start = addDays(cfg.customStart, k * len);
      return { start, end: addDays(start, len - 1) };
    }
  }
}

export function shiftPeriod(cfg: PeriodConfig, p: Period, delta: number): Period {
  let cur = p;
  for (let i = 0; i < Math.abs(delta); i++) {
    cur = periodAt(cfg, delta > 0 ? addDays(cur.end, 1) : addDays(cur.start, -1));
  }
  return cur;
}

export function periodLength(p: Period): number {
  return diffDays(p.start, p.end) + 1;
}

export function inPeriod(p: Period, date: string): boolean {
  return date >= p.start && date <= p.end;
}

/** Jours restants dans la période, aujourd'hui inclus (0 si passée). */
export function daysLeftInPeriod(p: Period, todayISO: string): number {
  if (todayISO > p.end) return 0;
  if (todayISO < p.start) return periodLength(p);
  return diffDays(todayISO, p.end) + 1;
}

/** Part de la période déjà écoulée (0 à 1), aujourd'hui compté comme entamé. */
export function elapsedRatio(p: Period, todayISO: string): number {
  if (todayISO > p.end) return 1;
  if (todayISO < p.start) return 0;
  return (diffDays(p.start, todayISO) + 1) / periodLength(p);
}

/** Durée moyenne d'une période en jours (pour convertir les budgets). */
export function averageDays(cfg: PeriodConfig): number {
  switch (cfg.kind) {
    case 'jour': return 1;
    case 'semaine': return 7;
    case 'mois': return 30.4375;
    case 'annee': return 365.25;
    case 'libre': return cfg.customLength;
  }
}

/** Convertit un budget d'une période à une autre, arrondi aux 50 F. */
export function convertBudget(amount: number, from: PeriodConfig, to: PeriodConfig): number {
  if (amount <= 0) return 0;
  const v = (amount * averageDays(to)) / averageDays(from);
  return Math.max(50, Math.round(v / 50) * 50);
}

const MONTHS = ['janv.', 'févr.', 'mars', 'avr.', 'mai', 'juin', 'juil.', 'août', 'sept.', 'oct.', 'nov.', 'déc.'];
const MONTHS_LONG = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'];
const DAYS = ['dim.', 'lun.', 'mar.', 'mer.', 'jeu.', 'ven.', 'sam.'];

function dayMonth(iso: string): string {
  const d = parseISODate(iso);
  return `${d.getDate()} ${MONTHS[d.getMonth()]}`;
}

/** Libellé lisible de la période : « Novembre 2026 », « 3 – 9 nov. », « Aujourd'hui »… */
export function formatPeriod(cfg: PeriodConfig, p: Period, todayISO: string): string {
  const s = parseISODate(p.start);
  switch (cfg.kind) {
    case 'jour': {
      if (p.start === todayISO) return 'Aujourd’hui';
      if (p.start === addDays(todayISO, -1)) return 'Hier';
      return `${DAYS[s.getDay()]} ${dayMonth(p.start)}`;
    }
    case 'mois':
      if (cfg.monthStartDay === 1) {
        const m = MONTHS_LONG[s.getMonth()];
        return `${m.charAt(0).toUpperCase()}${m.slice(1)} ${s.getFullYear()}`;
      }
      return `${dayMonth(p.start)} – ${dayMonth(p.end)}`;
    case 'annee':
      return String(s.getFullYear());
    case 'semaine':
    case 'libre': {
      const e = parseISODate(p.end);
      const sameMonth = s.getMonth() === e.getMonth() && s.getFullYear() === e.getFullYear();
      return sameMonth ? `${s.getDate()} – ${dayMonth(p.end)}` : `${dayMonth(p.start)} – ${dayMonth(p.end)}`;
    }
  }
}

/** Libellé court pour les graphiques. */
export function formatPeriodShort(cfg: PeriodConfig, p: Period): string {
  const s = parseISODate(p.start);
  switch (cfg.kind) {
    case 'jour': return `${DAYS[s.getDay()].slice(0, 3)} ${s.getDate()}`;
    case 'mois': return cfg.monthStartDay === 1 ? MONTHS[s.getMonth()] : dayMonth(p.start);
    case 'annee': return String(s.getFullYear());
    default: return dayMonth(p.start);
  }
}

/** « cette semaine », « ce mois-ci »… pour les phrases. */
export function periodPhrase(cfg: PeriodConfig): string {
  switch (cfg.kind) {
    case 'jour': return 'aujourd’hui';
    case 'semaine': return 'cette semaine';
    case 'mois': return 'ce mois-ci';
    case 'annee': return 'cette année';
    case 'libre': return 'sur cette période';
  }
}

/** « par semaine », « par mois »… */
export function perPeriodPhrase(cfg: PeriodConfig): string {
  switch (cfg.kind) {
    case 'jour': return 'par jour';
    case 'semaine': return 'par semaine';
    case 'mois': return 'par mois';
    case 'annee': return 'par an';
    case 'libre': return `tous les ${cfg.customLength} jours`;
  }
}

export function periodKindLabel(cfg: PeriodConfig): string {
  const k = PERIOD_KINDS.find((x) => x.kind === cfg.kind)!.label;
  if (cfg.kind === 'libre') return `${k} · ${cfg.customLength} jours`;
  if (cfg.kind === 'mois' && cfg.monthStartDay !== 1) return `${k} · à partir du ${cfg.monthStartDay}`;
  return k;
}

export function previousPeriodLabel(cfg: PeriodConfig): string {
  switch (cfg.kind) {
    case 'jour': return 'hier';
    case 'semaine': return 'la semaine dernière';
    case 'mois': return 'le mois dernier';
    case 'annee': return 'l’an dernier';
    case 'libre': return 'la période précédente';
  }
}
