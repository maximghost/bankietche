/** Utilitaires de dates en heure locale, au format 'YYYY-MM-DD' (jour) et 'YYYY-MM' (mois). */

const pad = (n: number) => String(n).padStart(2, '0');

export function toISODate(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function parseISODate(s: string): Date {
  const [y, m, d] = s.split('-').map(Number);
  return new Date(y, m - 1, d);
}

export function today(now: Date = new Date()): string {
  return toISODate(now);
}

export function monthOf(date: string): string {
  return date.slice(0, 7);
}

export function currentMonth(now: Date = new Date()): string {
  return monthOf(today(now));
}

export function addMonthsToMonth(month: string, delta: number): string {
  const [y, m] = month.split('-').map(Number);
  const d = new Date(y, m - 1 + delta, 1);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}`;
}

export function daysInMonth(month: string): number {
  const [y, m] = month.split('-').map(Number);
  return new Date(y, m, 0).getDate();
}

/** Ajoute des jours à une date ISO. */
export function addDays(date: string, days: number): string {
  const d = parseISODate(date);
  d.setDate(d.getDate() + days);
  return toISODate(d);
}

/** Ajoute des mois en ramenant au dernier jour du mois si nécessaire (31 jan + 1 mois = 28/29 fév). */
export function addMonths(date: string, months: number): string {
  const d = parseISODate(date);
  const day = d.getDate();
  const target = new Date(d.getFullYear(), d.getMonth() + months, 1);
  const last = new Date(target.getFullYear(), target.getMonth() + 1, 0).getDate();
  target.setDate(Math.min(day, last));
  return toISODate(target);
}

/** Nombre de jours entre deux dates ISO (b - a). */
export function diffDays(a: string, b: string): number {
  const ms = parseISODate(b).getTime() - parseISODate(a).getTime();
  return Math.round(ms / 86_400_000);
}

/**
 * Jours restants dans le mois, aujourd'hui inclus.
 * Mois passé : 0. Mois futur : nombre total de jours du mois.
 */
export function daysLeftInMonth(month: string, todayISO: string = today()): number {
  const cur = monthOf(todayISO);
  if (month < cur) return 0;
  if (month > cur) return daysInMonth(month);
  return daysInMonth(month) - Number(todayISO.slice(8, 10)) + 1;
}

const MONTHS_FR = [
  'janvier', 'février', 'mars', 'avril', 'mai', 'juin',
  'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre',
];

export function formatMonth(month: string): string {
  const [y, m] = month.split('-').map(Number);
  const name = MONTHS_FR[m - 1];
  return `${name.charAt(0).toUpperCase()}${name.slice(1)} ${y}`;
}

const MONTHS_SHORT_FR = ['janv.', 'févr.', 'mars', 'avr.', 'mai', 'juin', 'juil.', 'août', 'sept.', 'oct.', 'nov.', 'déc.'];

export function formatMonthShort(month: string): string {
  return MONTHS_SHORT_FR[Number(month.slice(5, 7)) - 1];
}

const DAYS_FR = ['dimanche', 'lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi'];

/** "Aujourd'hui", "Hier", ou "lundi 3 novembre". */
export function formatDayLabel(date: string, todayISO: string = today()): string {
  if (date === todayISO) return "Aujourd'hui";
  if (date === addDays(todayISO, -1)) return 'Hier';
  if (date === addDays(todayISO, 1)) return 'Demain';
  const d = parseISODate(date);
  const label = `${DAYS_FR[d.getDay()]} ${d.getDate()} ${MONTHS_FR[d.getMonth()]}`;
  return d.getFullYear() === parseISODate(todayISO).getFullYear() ? label : `${label} ${d.getFullYear()}`;
}

export function formatShortDate(date: string): string {
  const d = parseISODate(date);
  return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()}`;
}

/** « vendredi 6 novembre » (sans « Aujourd'hui »). */
export function formatLongDate(date: string): string {
  const d = parseISODate(date);
  return `${DAYS_FR[d.getDay()]} ${d.getDate()} ${MONTHS_FR[d.getMonth()]}`;
}
