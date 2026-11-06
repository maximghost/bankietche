import type { PeriodSummary } from './budget';
import { diffDays } from './dates';
import { formatF } from './money';
import { periodPhrase, type PeriodConfig } from './period';

/**
 * Messages personnalisés de l'accueil. Ton : tutoiement, bienveillant,
 * direct, jamais culpabilisant. Le message dépend de la situation réelle.
 * Plusieurs formulations par cas, choisies de façon stable dans la journée
 * (le message ne change pas à chaque ouverture).
 */

export type Tone = 'good' | 'info' | 'warn' | 'alert';

export interface CoachMessage {
  tone: Tone;
  title: string;
  text: string;
}

export interface CoachInput {
  name: string;
  cfg: PeriodConfig;
  summary: PeriodSummary;
  isCurrent: boolean;
  hasAnyData: boolean;
  lateTontines: number;
  /** Objectifs atteints et non archivés. */
  goalsReached: number;
  todayISO: string;
}

export function greeting(name: string, hour: number): string {
  const salut = hour >= 5 && hour < 18 ? 'Bonjour' : 'Bonsoir';
  return name ? `${salut}, ${name}` : salut;
}

function pick<T>(options: T[], todayISO: string, salt: number): T {
  const seed = diffDays('2026-01-01', todayISO) + salt;
  return options[((seed % options.length) + options.length) % options.length];
}

export function coachMessage(i: CoachInput): CoachMessage {
  const n = i.name ? `${i.name}, ` : '';
  const N = i.name || '';
  const s = i.summary;
  const when = periodPhrase(i.cfg);

  if (!i.hasAnyData) {
    return {
      tone: 'info',
      title: N ? `Bienvenue, ${N} !` : 'Bienvenue !',
      text: 'Commence par noter l’argent dont tu disposes, puis chaque dépense. En quelques jours, tu verras clairement où part ton argent.',
    };
  }

  if (!i.isCurrent) {
    return {
      tone: 'info',
      title: 'Période passée',
      text: s.expense > 0
        ? `Sur cette période, tu as dépensé ${formatF(s.expense)} et mis ${formatF(s.saving)} de côté.`
        : 'Aucune dépense enregistrée sur cette période.',
    };
  }

  if (s.remaining < 0) {
    return pick<CoachMessage>([
      { tone: 'alert', title: `${n}on freine un peu ?`, text: `Tu as dépassé ${s.remainingMode === 'budget' ? 'ton budget' : 'ton argent disponible'} de ${formatF(-s.remaining)}. D’ici la fin de la période, garde l’essentiel : manger, te déplacer, étudier.` },
      { tone: 'alert', title: 'Alerte dépassement', text: `${n}tu es à ${formatF(-s.remaining)} au-delà de ${s.remainingMode === 'budget' ? 'ton budget' : 'ce que tu as'}. Chaque petite dépense évitée compte maintenant.` },
    ], i.todayISO, 1);
  }

  if (i.lateTontines > 0) {
    return {
      tone: 'warn',
      title: 'Cotisation en retard',
      text: `${n}tu as ${i.lateTontines} cotisation${i.lateTontines > 1 ? 's' : ''} de tontine en retard. Régularise vite pour garder la confiance du groupe.`,
    };
  }

  const over = s.alerts.find((a) => a.ratio >= 1);
  if (over) {
    return {
      tone: 'warn',
      title: `Budget « ${over.category.name} » épuisé`,
      text: `${n}tu as déjà dépensé ${formatF(over.spent)} sur ${formatF(over.budget)} prévus ${when}. Essaie de ne plus rien ajouter dans cette catégorie.`,
    };
  }

  if (i.goalsReached > 0) {
    return { tone: 'good', title: N ? `Bravo, ${N} !` : 'Bravo !', text: 'Tu as atteint un objectif d’épargne. Archive-le et fixe-toi le suivant : c’est comme ça qu’on construit ses projets.' };
  }

  // Rythme de dépense : comparé à la part de la période déjà écoulée.
  if (s.remainingMode === 'budget' && s.totalBudget > 0 && s.elapsed < 1) {
    const spentRatio = s.expense / s.totalBudget;
    if (spentRatio > s.elapsed + 0.15) {
      return pick<CoachMessage>([
        { tone: 'warn', title: 'Tu dépenses vite', text: `${n}tu as utilisé ${Math.round(spentRatio * 100)} % de ton budget alors que ${Math.round(s.elapsed * 100)} % de la période est passée. Vise ${formatF(s.perDay)} par jour pour tenir.` },
        { tone: 'warn', title: 'Petit coup de frein', text: `À ce rythme, ton budget ne tiendra pas jusqu’au bout. ${N ? `${N}, ` : ''}limite-toi à ${formatF(s.perDay)} par jour.` },
      ], i.todayISO, 2);
    }
    if (s.expense > 0) {
      return pick<CoachMessage>([
        { tone: 'good', title: N ? `Bien joué, ${N} !` : 'Bien joué !', text: `Tu es dans les clous : ${Math.round(spentRatio * 100)} % du budget utilisé ${when}. Continue comme ça.` },
        { tone: 'good', title: 'Tout est sous contrôle', text: `${n}tu peux encore dépenser ${formatF(s.perDay)} par jour sans dépasser ton budget.` },
        { tone: 'good', title: 'Belle discipline', text: `Ton budget tient la route. Pense à mettre un peu de côté pour tes objectifs.` },
      ], i.todayISO, 3);
    }
  }

  if (s.remainingMode === 'available') {
    if (s.available <= 0) {
      return { tone: 'warn', title: 'Caisse vide', text: `${n}selon tes notes, il ne te reste plus d’argent disponible. Pense à enregistrer tes entrées pour que le calcul soit juste.` };
    }
    return pick<CoachMessage>([
      { tone: 'info', title: N ? `${N}, voici ton repère` : 'Ton repère du jour', text: `Pour que ton argent dure jusqu’à la fin de la période, ne dépasse pas ${formatF(s.perDay)} par jour.` },
      { tone: 'info', title: 'Astuce', text: `Fixe des budgets par catégorie dans les réglages : Bankiétché t’alertera avant que ça déborde.` },
    ], i.todayISO, 4);
  }

  if (s.saving > 0) {
    return { tone: 'good', title: 'Épargne en marche', text: `${n}tu as déjà mis ${formatF(s.saving)} de côté ${when}. Ton futur toi te dit merci.` };
  }

  return { tone: 'info', title: N ? `Prêt, ${N} ?` : 'Prêt ?', text: `Note chaque dépense dès qu’elle arrive : c’est le meilleur moyen de garder le contrôle ${when}.` };
}
