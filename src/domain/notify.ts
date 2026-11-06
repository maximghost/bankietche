import { summarizePeriod } from './budget';
import { addDays, diffDays } from './dates';
import { formatF } from './money';
import { periodAt, periodPhrase } from './period';
import { tontineStatus } from './tontine';
import type { AppData, Settings } from './types';

/**
 * Contenu de la notification quotidienne.
 *
 * Le serveur n'envoie qu'un « réveil » sans aucune donnée : c'est le téléphone
 * qui calcule le message à partir de ses données locales. Le message s'affiche
 * sur l'écran verrouillé, donc par défaut il reste GÉNÉRAL (ni montant, ni nom
 * de catégorie, de tontine ou d'objectif, ni prénom). Le mode détaillé, activé
 * volontairement par l'utilisateur, ajoute ces précisions. Le mode discret
 * force toujours le message général.
 */

export interface DailyNotification {
  title: string;
  body: string;
  /** Même tag = remplace la notification précédente au lieu de s'empiler. */
  tag: string;
  kind: 'tontine-late' | 'tontine-soon' | 'budget-over' | 'category-over' | 'pace' | 'no-entry'
    | 'last-day' | 'backup' | 'nudge' | 'welcome';
}

export interface NotifyInput {
  data: AppData;
  settings: Settings;
  todayISO: string;
  lastBackupAt: string | null;
  now?: Date;
}

const TAG = 'bankietche-quotidien';

export function buildDailyNotification(i: NotifyInput): DailyNotification {
  const { data, settings, todayISO } = i;
  const detailed = settings.notifications.detailed && !settings.discreet;
  const hi = detailed && settings.name ? `${settings.name}, ` : '';
  const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
  const make = (kind: DailyNotification['kind'], title: string, body: string): DailyNotification => ({ kind, title, body, tag: TAG });

  if (data.transactions.length === 0) {
    return make('welcome', 'Bankiétché', 'Note ton premier mouvement d’argent : en quelques jours, tu sauras où il part.');
  }

  // 1. Tontines : retard, puis échéance aujourd'hui ou demain.
  const active = data.tontines.filter((t) => !t.archived);
  const statuses = active.map((t) => ({ t, s: tontineStatus(t, data.transactions, todayISO) }));
  const late = statuses.filter((x) => x.s.late > 0);
  if (late.length > 0) {
    const n = late.reduce((a, x) => a + x.s.late, 0);
    return make('tontine-late', 'Cotisation en retard',
      detailed
        ? `${cap(hi)}${n} cotisation${n > 1 ? 's' : ''} en retard (${late.map((x) => `« ${x.t.name} »`).join(', ')}). Régularise vite pour garder la confiance du groupe.`
        : `${n > 1 ? `${n} cotisations de tontine sont` : 'Une cotisation de tontine est'} en retard. Ouvre Bankiétché pour faire le point.`);
  }
  const tomorrow = addDays(todayISO, 1);
  const soon = statuses.filter((x) => x.s.nextDue === todayISO || x.s.nextDue === tomorrow);
  if (soon.length > 0) {
    const today = soon.some((x) => x.s.nextDue === todayISO);
    const when = today ? 'aujourd’hui' : 'demain';
    return make('tontine-soon', `Cotisation ${when}`,
      detailed
        ? `${cap(hi)}${soon.map((x) => `« ${x.t.name} » : ${formatF(x.t.amount)}`).join(' ; ')} à verser ${when}.`
        : `Tu as une cotisation de tontine à verser ${when}.`);
  }

  // 2. Budget de la période en cours.
  const period = periodAt(settings.period, todayISO);
  const s = summarizePeriod(data.transactions, data.categories, period, todayISO);
  const when = periodPhrase(settings.period);

  if (s.remainingMode === 'budget' && s.remaining < 0) {
    return make('budget-over', 'Budget dépassé',
      detailed
        ? `${cap(hi)}tu as dépassé ton budget de ${formatF(-s.remaining)} ${when}. Garde l’essentiel jusqu’à la fin de la période.`
        : `Tu as dépassé ton budget ${when}. Ouvre Bankiétché pour faire le point.`);
  }
  const over = s.alerts.filter((a) => a.ratio >= 1);
  if (over.length > 0) {
    return make('category-over', over.length > 1 ? 'Des budgets sont épuisés' : 'Un budget est épuisé',
      detailed
        ? `${cap(hi)}${over.map((a) => `${a.category.name} : ${Math.round(a.ratio * 100)} %`).join(', ')}. Évite d’ajouter des dépenses dans ${over.length > 1 ? 'ces catégories' : 'cette catégorie'}.`
        : `${over.length > 1 ? `${over.length} catégories ont` : 'Une catégorie a'} atteint son budget ${when}.`);
  }
  if (s.remainingMode === 'budget' && s.totalBudget > 0 && s.elapsed < 1 && s.expense / s.totalBudget > s.elapsed + 0.15) {
    return make('pace', 'Ça file vite',
      detailed
        ? `${cap(hi)}${Math.round((s.expense / s.totalBudget) * 100)} % du budget utilisé ${when}. Vise ${formatF(s.perDay)} par jour pour tenir.`
        : `Tu dépenses plus vite que prévu ${when}. Un petit coup de frein ?`);
  }

  // 3. Habitudes : rien noté aujourd'hui, dernier jour de période, sauvegarde.
  const notedToday = data.transactions.some((t) => t.date === todayISO);
  if (!notedToday) {
    return make('no-entry', 'Petit point du jour',
      detailed && settings.name
        ? `${settings.name}, as-tu noté tes dépenses d’aujourd’hui ? Ça prend 5 secondes.`
        : 'As-tu noté tes dépenses d’aujourd’hui ? Ça prend 5 secondes.');
  }
  if (settings.period.kind !== 'jour' && period.end === todayISO) {
    return make('last-day', 'Dernier jour de la période', 'Demain, une nouvelle période commence. Jette un œil à ton bilan.');
  }
  const backupDays = i.lastBackupAt ? diffDays(i.lastBackupAt.slice(0, 10), todayISO) : Infinity;
  if (data.transactions.length >= 5 && backupDays > 14) {
    return make('backup', 'Pense à sauvegarder', 'Une sauvegarde régulière protège tes données si tu changes de téléphone.');
  }

  return make('nudge', 'Tout est noté',
    detailed && settings.name ? `Bien joué, ${settings.name} ! Tes dépenses du jour sont à jour.` : 'Bien joué ! Tes dépenses du jour sont à jour.');
}
