import { ChartColumn } from 'lucide-preact';
import { useMemo } from 'preact/hooks';
import { expenseChangeVsPrevious, periodTrend, summarizePeriod } from '../../domain/budget';
import { percent } from '../../domain/money';
import { formatPeriodShort, previousPeriodLabel } from '../../domain/period';
import { PAYMENT_METHODS } from '../../domain/types';
import { useStore } from '../../state/store';
import { budgetTone, Empty, PeriodNav, Progress } from '../components';
import { useMoney } from '../format';
import { IconBadge } from '../icon-registry';
import { useUI } from '../ui-context';

const methodInfo = new Map(PAYMENT_METHODS.map((m) => [m.id, m]));

export function StatsScreen() {
  const { data, settings } = useStore();
  const ui = useUI();
  const fmt = useMoney();
  const cfg = settings.period;
  const s = useMemo(() => summarizePeriod(data.transactions, data.categories, ui.period, ui.today),
    [data.transactions, data.categories, ui.period, ui.today]);
  const change = useMemo(() => expenseChangeVsPrevious(cfg, data.transactions, ui.period), [cfg, data.transactions, ui.period]);
  const trend = useMemo(() => periodTrend(cfg, data.transactions, ui.period, 6), [cfg, data.transactions, ui.period]);
  const maxTrend = Math.max(1, ...trend.flatMap((t) => [t.income, t.expense]));
  const spentLines = s.byCategory.filter((l) => l.spent > 0);

  return (
    <div class="screen">
      <PeriodNav label={ui.periodLabel} sub={ui.periodSub} onPrev={() => ui.shift(-1)} onNext={() => ui.shift(1)} canNext={ui.canNext} />

      <section class="card">
        <p class="muted small">Total dépensé</p>
        <p class="stat-big">{fmt(s.expense)}</p>
        {change !== null && !settings.discreet && (
          <p class={`small ${change > 0 ? 'neg' : 'pos'}`}>
            <b>{change > 0 ? '+' : '−'}{Math.abs(change)} %</b> par rapport à {previousPeriodLabel(cfg)}
          </p>
        )}
      </section>

      {spentLines.length === 0 ? (
        <Empty icon={<ChartColumn size={30} />} title="Pas encore de dépenses" text="Les statistiques apparaîtront dès ta première dépense sur cette période." />
      ) : (
        <section class="card" aria-labelledby="where-h">
          <h3 class="card-title" id="where-h">Où part mon argent ?</h3>
          {spentLines.map((l) => (
            <div class="budget-line">
              <div class="budget-line-head">
                <IconBadge name={l.category.icon} size="sm" />
                <span class="grow">{l.category.name}</span>
                <span><b>{fmt(l.spent)}</b> <small class="muted">{percent(l.spent, s.expense)} %</small></span>
              </div>
              <Progress ratio={l.budget > 0 ? l.ratio : l.spent / s.expense} tone={l.budget > 0 ? budgetTone(l.ratio) : 'brand'}
                label={l.budget > 0 ? `${l.category.name} : part du budget` : `${l.category.name} : part des dépenses`} />
              {l.budget > 0 && <small class="muted">Budget : {fmt(l.budget)}</small>}
            </div>
          ))}
        </section>
      )}

      {s.byMethod.length > 0 && (
        <section class="card" aria-labelledby="method-h2">
          <h3 class="card-title" id="method-h2">Par moyen de paiement</h3>
          <div class="stack-bar" aria-hidden="true">
            {s.byMethod.map((m) => (
              <span style={{ width: `${(m.amount / s.expense) * 100}%`, background: methodInfo.get(m.method)?.color }} />
            ))}
          </div>
          {s.byMethod.map((m) => (
            <div class="row between line">
              <span class="row"><span class="dot" style={{ background: methodInfo.get(m.method)?.color }} />{methodInfo.get(m.method)?.label}</span>
              <span>{fmt(m.amount)} <small class="muted">{percent(m.amount, s.expense)} %</small></span>
            </div>
          ))}
        </section>
      )}

      <section class="card" aria-labelledby="trend-h">
        <h3 class="card-title" id="trend-h">6 dernières périodes</h3>
        <div class="trend" role="img" aria-label={trend.map((t) => `${formatPeriodShort(cfg, t.period)} : entrées ${fmt(t.income)}, dépenses ${fmt(t.expense)}`).join(' ; ')}>
          {trend.map((t) => (
            <div class={`trend-col ${t.period.start === ui.period.start ? 'current' : ''}`}>
              <div class="trend-bars">
                <span class="bar in" style={{ height: `${(t.income / maxTrend) * 100}%` }} />
                <span class="bar out" style={{ height: `${(t.expense / maxTrend) * 100}%` }} />
              </div>
              <span class="trend-label">{formatPeriodShort(cfg, t.period)}</span>
            </div>
          ))}
        </div>
        <div class="legend" aria-hidden="true"><span><i class="in" />Entrées</span><span><i class="out" />Dépenses</span></div>
      </section>
    </div>
  );
}
