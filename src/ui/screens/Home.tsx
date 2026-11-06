import {
  ArrowDownLeft, ArrowUpRight, CircleAlert, Info, PiggyBank, ShieldAlert, Sparkles, TriangleAlert, ChevronRight,
  Download, Handshake, Target, BellRing,
} from 'lucide-preact';
import { useMemo, useState } from 'preact/hooks';
import { pushSupport } from '../../services/push';
import { BACKUP_REMINDER_DAYS } from '../../config';
import { expenseChangeVsPrevious, summarizePeriod } from '../../domain/budget';
import { coachMessage, type Tone } from '../../domain/coach';
import { formatDayLabel } from '../../domain/dates';
import { goalStatus } from '../../domain/goals';
import { percent } from '../../domain/money';
import { periodPhrase, previousPeriodLabel } from '../../domain/period';
import { upcomingPayments } from '../../domain/tontine';
import { useCategoryMap, useStore } from '../../state/store';
import { budgetTone, Money, PeriodNav, Progress } from '../components';
import { useMoney } from '../format';
import { IconBadge } from '../icon-registry';
import { TransactionRow } from '../TransactionRow';
import { useUI } from '../ui-context';

const TONE_ICON: Record<Tone, typeof Info> = { good: Sparkles, info: Info, warn: TriangleAlert, alert: ShieldAlert };

export function HomeScreen() {
  const { data, settings, lastBackupAt } = useStore();
  const ui = useUI();
  const fmt = useMoney();
  const catMap = useCategoryMap();
  const cfg = settings.period;
  const todayISO = ui.today;

  const s = useMemo(() => summarizePeriod(data.transactions, data.categories, ui.period, todayISO),
    [data.transactions, data.categories, ui.period, todayISO]);
  const change = useMemo(() => expenseChangeVsPrevious(cfg, data.transactions, ui.period), [cfg, data.transactions, ui.period]);
  const upcoming = useMemo(() => upcomingPayments(data.tontines, data.transactions, todayISO).slice(0, 3),
    [data.tontines, data.transactions, todayISO]);
  const activeGoals = data.goals.filter((g) => !g.archived);
  const goalStatuses = activeGoals.map((g) => ({ g, st: goalStatus(g, data.transactions, cfg, todayISO) }));
  const recent = data.transactions.filter((t) => t.date >= ui.period.start && t.date <= ui.period.end).slice(0, 5);

  const hasAnyData = data.transactions.length > 0;
  const lateTontines = upcoming.reduce((n, u) => n + u.status.late, 0);
  const coach = coachMessage({
    name: settings.name, cfg, summary: s, isCurrent: ui.isCurrent, hasAnyData, lateTontines,
    goalsReached: goalStatuses.filter((x) => x.st.reached).length, todayISO,
  });
  const CoachIcon = TONE_ICON[coach.tone];

  const backupDays = lastBackupAt ? (Date.now() - new Date(lastBackupAt).getTime()) / 86_400_000 : Infinity;
  const needBackup = data.transactions.length >= 5 && backupDays > BACKUP_REMINDER_DAYS;

  const [promptHidden, setPromptHidden] = useState(() => {
    try { return localStorage.getItem('bk:notifPromptHidden') === '1'; } catch { return false; }
  });
  const support = pushSupport();
  const showNotifPrompt = hasAnyData && !settings.notifications.enabled && !promptHidden && (support === 'ok' || support === 'ios-install');
  const hidePrompt = () => {
    try { localStorage.setItem('bk:notifPromptHidden', '1'); } catch { /* sans conséquence */ }
    setPromptHidden(true);
  };

  const heroLabel = s.remainingMode === 'budget' ? 'Reste de ton budget' : 'Ton argent disponible';
  const heroChip = s.remainingMode === 'budget' ? periodPhrase(cfg) : 'solde actuel';

  return (
    <div class="screen">
      <PeriodNav label={ui.periodLabel} sub={ui.periodSub} onPrev={() => ui.shift(-1)} onNext={() => ui.shift(1)} canNext={ui.canNext} />
      {!ui.isCurrent && <button class="btn-link" onClick={ui.backToCurrent}>Revenir à la période en cours</button>}

      <section class={`hero ${s.remaining < 0 ? 'hero-negative' : ''}`} aria-label={heroLabel}>
        <div class="hero-top">
          <p class="hero-label">{heroLabel}</p>
          <span class="hero-chip">{heroChip}</span>
        </div>
        <p class="hero-amount">{fmt(s.remaining)}</p>
        <p class="hero-sub">
          {s.remaining < 0
            ? `Dépassement de ${fmt(-s.remaining)}`
            : ui.isCurrent && s.perDay > 0
              ? <>Soit <b>{fmt(s.perDay)}</b> par jour {s.daysLeft > 1 ? `pendant ${s.daysLeft} jours` : 'aujourd’hui'}</>
              : !ui.isCurrent ? 'Période terminée' : hasAnyData ? '' : 'Ajoute tes entrées pour commencer'}
        </p>
        {s.remainingMode === 'budget' && (
          <div class="hero-progress">
            <Progress ratio={s.totalBudget > 0 ? s.expense / s.totalBudget : 0} label="Part du budget utilisée" />
            <span>{fmt(s.expense)} dépensés sur {fmt(s.totalBudget)} · disponible : {fmt(s.available)}</span>
          </div>
        )}
      </section>

      <section class={`coach tone-${coach.tone}`} role="status">
        <span class="coach-icon"><CoachIcon size={20} aria-hidden="true" /></span>
        <div>
          <p class="coach-title">{coach.title}</p>
          <p class="coach-text">{coach.text}</p>
        </div>
      </section>

      <nav class="quick" aria-label="Actions rapides">
        <button class="quick-btn" onClick={() => ui.open({ kind: 'tx', draft: { type: 'depense' } })}>
          <span class="quick-ico qi-out"><ArrowUpRight size={22} aria-hidden="true" /></span>Dépense
        </button>
        <button class="quick-btn" onClick={() => ui.open({ kind: 'tx', draft: { type: 'revenu' } })}>
          <span class="quick-ico qi-in"><ArrowDownLeft size={22} aria-hidden="true" /></span>Entrée
        </button>
        <button class="quick-btn" onClick={() => ui.open({ kind: 'tx', draft: { type: 'epargne' } })}>
          <span class="quick-ico qi-save"><PiggyBank size={22} aria-hidden="true" /></span>Épargner
        </button>
      </nav>

      <section class="kpis" aria-label="Résumé de la période">
        <div class="kpi"><span class="kpi-label">Entrées</span><Money value={s.income} class="pos" /></div>
        <div class="kpi">
          <span class="kpi-label">Dépenses</span><Money value={s.expense} class="neg" />
          {change !== null && !settings.discreet && (
            <small class={change > 0 ? 'neg' : 'pos'}>
              {change > 0 ? '+' : '−'}{Math.abs(change)} % vs {previousPeriodLabel(cfg)}
            </small>
          )}
        </div>
        <div class="kpi"><span class="kpi-label">Épargné</span><Money value={s.saving} class="save" /></div>
      </section>

      {showNotifPrompt && (
        <section class="banner tone-info" aria-labelledby="notif-h">
          <BellRing size={22} aria-hidden="true" />
          <div class="grow">
            <p id="notif-h"><b>Ne rate plus rien.</b> Un rappel par jour pour tes cotisations et ton budget, sans divulguer tes données.</p>
            <div class="banner-actions">
              <button class="btn btn-primary" onClick={ui.openNotifications}>Activer</button>
              <button class="btn btn-ghost" onClick={hidePrompt}>Plus tard</button>
            </div>
          </div>
        </section>
      )}

      {needBackup && (
        <button class="banner tone-warn" onClick={ui.openSettings}>
          <Download size={22} aria-hidden="true" />
          <span class="grow"><b>Pense à sauvegarder.</b> Sans sauvegarde, tes données sont perdues si tu changes de téléphone.</span>
          <ChevronRight size={20} aria-hidden="true" />
        </button>
      )}

      {s.alerts.length > 0 && (
        <section class="card" aria-labelledby="alerts-h">
          <h3 class="card-title" id="alerts-h"><CircleAlert size={20} aria-hidden="true" /> Budgets à surveiller</h3>
          {s.alerts.map((a) => (
            <div class="budget-line">
              <div class="budget-line-head">
                <IconBadge name={a.category.icon} size="sm" />
                <span class="grow">{a.category.name}</span>
                <span class={a.ratio >= 1 ? 'neg' : 'warn'}><b>{percent(a.spent, a.budget)} %</b></span>
              </div>
              <Progress ratio={a.ratio} tone={budgetTone(a.ratio)} label={`${a.category.name} : part du budget utilisée`} />
            </div>
          ))}
        </section>
      )}

      {upcoming.length > 0 && (
        <section class="card" aria-labelledby="tontine-h">
          <button class="card-title link" id="tontine-h" onClick={() => ui.setTab('savings')}>
            <span class="row gap"><Handshake size={20} aria-hidden="true" /> Prochaines cotisations</span>
            <span class="muted-link">Voir <ChevronRight size={16} aria-hidden="true" /></span>
          </button>
          {upcoming.map(({ tontine, status }) => (
            <div class="row between line">
              <span>{tontine.name}<br /><small class={status.late > 0 ? 'neg' : 'muted'}>
                {status.late > 0 ? `${status.late} cotisation${status.late > 1 ? 's' : ''} en retard` : formatDayLabel(status.nextDue!, todayISO)}
              </small></span>
              <Money value={tontine.amount} />
            </div>
          ))}
        </section>
      )}

      {goalStatuses.length > 0 && (
        <section class="card" aria-labelledby="goals-h">
          <button class="card-title link" id="goals-h" onClick={() => ui.setTab('savings')}>
            <span class="row gap"><Target size={20} aria-hidden="true" /> Mes objectifs</span>
            <span class="muted-link">Voir <ChevronRight size={16} aria-hidden="true" /></span>
          </button>
          {goalStatuses.slice(0, 3).map(({ g, st }) => (
            <div class="budget-line">
              <div class="budget-line-head">
                <IconBadge name={g.icon} size="sm" tint="violet" />
                <span class="grow">{g.name}</span>
                <span class="muted">{percent(st.saved, g.target)} %</span>
              </div>
              <Progress ratio={st.ratio} tone={st.reached ? 'ok' : 'brand'} label={`${g.name} : progression`} />
            </div>
          ))}
        </section>
      )}

      {recent.length > 0 && (
        <section class="card flush" aria-labelledby="recent-h">
          <button class="card-title link pad" id="recent-h" onClick={() => ui.setTab('history')}>
            <span>Dernières opérations</span>
            <span class="muted-link">Tout voir <ChevronRight size={16} aria-hidden="true" /></span>
          </button>
          {recent.map((tx) => (
            <TransactionRow tx={tx} categories={catMap} goals={data.goals} tontines={data.tontines}
              onClick={() => ui.open({ kind: 'tx', draft: tx })} />
          ))}
        </section>
      )}
    </div>
  );
}
