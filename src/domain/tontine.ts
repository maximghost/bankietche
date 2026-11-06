import { addDays, addMonths, diffDays, today } from './dates';
import type { Frequency, Tontine, Transaction } from './types';

/** Date de l'échéance n° index (0 = première cotisation). */
export function dueDate(t: Pick<Tontine, 'startDate' | 'frequency'>, index: number): string {
  return periodDate(t.startDate, t.frequency, index);
}

export function periodDate(start: string, frequency: Frequency, index: number): string {
  switch (frequency) {
    case 'jour':
      return addDays(start, index);
    case 'semaine':
      return addDays(start, index * 7);
    case 'mois':
      return addMonths(start, index);
  }
}

export interface TontineStatus {
  /** Cagnotte reçue au ramassage (cotisation × participants). */
  pot: number;
  /** Nombre d'échéances déjà arrivées (aujourd'hui inclus), plafonné au nombre de tours. */
  dueCount: number;
  paidCount: number;
  paidAmount: number;
  /** Cotisations en retard : échéances PASSÉES (avant aujourd'hui) non payées. */
  late: number;
  /** Prochaine échéance non réglée, ou null si tout est payé. */
  nextDue: string | null;
  /** Date de mon ramassage. */
  myCollectDate: string;
  collected: boolean;
  collectedAmount: number;
  /** Jours avant mon ramassage (négatif si passé). */
  daysToCollect: number;
  finished: boolean;
  endDate: string;
}

export function tontineStatus(
  t: Tontine,
  txs: Transaction[],
  todayISO: string = today(),
): TontineStatus {
  const own = txs.filter((x) => x.tontineId === t.id);
  const payments = own.filter((x) => x.type === 'depense');
  const collections = own.filter((x) => x.type === 'revenu');

  const paidAmount = payments.reduce((s, x) => s + x.amount, 0);
  // Une cotisation partielle ne compte pas comme une échéance réglée.
  const paidCount = t.amount > 0 ? Math.min(t.members, Math.floor(paidAmount / t.amount)) : 0;

  let dueCount = 0;
  while (dueCount < t.members && dueDate(t, dueCount) <= todayISO) dueCount++;

  // L'échéance du jour n'est pas encore « en retard ».
  const pastDue = dueCount > 0 && dueDate(t, dueCount - 1) === todayISO ? dueCount - 1 : dueCount;
  const late = Math.max(0, pastDue - paidCount);
  const nextDue = paidCount < t.members ? dueDate(t, paidCount) : null;
  const myCollectDate = dueDate(t, Math.max(0, Math.min(t.myTurn, t.members) - 1));
  const collectedAmount = collections.reduce((s, x) => s + x.amount, 0);
  const endDate = dueDate(t, t.members - 1);

  return {
    pot: t.amount * t.members,
    dueCount,
    paidCount,
    paidAmount,
    late,
    nextDue,
    myCollectDate,
    collected: collectedAmount > 0,
    collectedAmount,
    daysToCollect: diffDays(todayISO, myCollectDate),
    finished: paidCount >= t.members && collectedAmount > 0,
    endDate,
  };
}

/** Prochaines cotisations (toutes tontines actives), triées par date. */
export function upcomingPayments(tontines: Tontine[], txs: Transaction[], todayISO: string = today()) {
  return tontines
    .filter((t) => !t.archived)
    .map((t) => ({ tontine: t, status: tontineStatus(t, txs, todayISO) }))
    .filter((x) => x.status.nextDue !== null)
    .sort((a, b) => (a.status.nextDue! < b.status.nextDue! ? -1 : 1));
}
