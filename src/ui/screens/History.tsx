import { ReceiptText, Search } from 'lucide-preact';
import { useMemo, useState } from 'preact/hooks';
import { formatDayLabel } from '../../domain/dates';
import type { Transaction, TxType } from '../../domain/types';
import { useCategoryMap, useStore } from '../../state/store';
import { Empty, Money, PeriodNav } from '../components';
import { TransactionRow } from '../TransactionRow';
import { useUI } from '../ui-context';

type Filter = 'tout' | TxType;
const FILTERS: { value: Filter; label: string }[] = [
  { value: 'tout', label: 'Tout' },
  { value: 'depense', label: 'Dépenses' },
  { value: 'revenu', label: 'Entrées' },
  { value: 'epargne', label: 'Épargne' },
];

const norm = (s: string) => s.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase();

export function HistoryScreen() {
  const { data } = useStore();
  const ui = useUI();
  const catMap = useCategoryMap();
  const [filter, setFilter] = useState<Filter>('tout');
  const [query, setQuery] = useState('');

  const groups = useMemo(() => {
    const q = norm(query.trim());
    const list = data.transactions.filter((t) => {
      if (t.date < ui.period.start || t.date > ui.period.end) return false;
      if (filter !== 'tout' && t.type !== filter) return false;
      if (!q) return true;
      const cat = t.categoryId ? catMap.get(t.categoryId)?.name ?? '' : '';
      const goal = t.goalId ? data.goals.find((g) => g.id === t.goalId)?.name ?? '' : '';
      return norm(`${t.note ?? ''} ${cat} ${goal}`).includes(q);
    });
    const byDay = new Map<string, Transaction[]>();
    for (const t of list) {
      const arr = byDay.get(t.date) ?? [];
      arr.push(t);
      byDay.set(t.date, arr);
    }
    return [...byDay.entries()].map(([date, txs]) => ({
      date,
      txs,
      net: txs.reduce((s, t) => s + (t.type === 'revenu' ? t.amount : -t.amount), 0),
    }));
  }, [data.transactions, data.goals, catMap, ui.period, filter, query]);

  return (
    <div class="screen">
      <PeriodNav label={ui.periodLabel} sub={ui.periodSub} onPrev={() => ui.shift(-1)} onNext={() => ui.shift(1)} canNext={ui.canNext} />
      <label class="search">
        <Search size={18} aria-hidden="true" />
        <span class="sr-only">Rechercher une opération</span>
        <input type="search" placeholder="Rechercher (note, catégorie…)" value={query}
          onInput={(e) => setQuery(e.currentTarget.value)} />
      </label>
      <div class="chips scroll" role="group" aria-label="Filtrer par type">
        {FILTERS.map((f) => (
          <button class="chip" aria-pressed={filter === f.value} onClick={() => setFilter(f.value)}>{f.label}</button>
        ))}
      </div>

      {groups.length === 0 ? (
        <Empty icon={<ReceiptText size={30} />} title="Aucune opération"
          text={query || filter !== 'tout' ? 'Essaie un autre filtre ou une autre recherche.' : 'Rien n’a été noté sur cette période.'} />
      ) : groups.map((g) => (
        <section class="day-group" aria-label={formatDayLabel(g.date, ui.today)}>
          <div class="day-head">
            <span>{formatDayLabel(g.date, ui.today)}</span>
            <Money value={g.net} sign class={g.net >= 0 ? 'pos' : 'neg'} />
          </div>
          <div class="card flush">
            {g.txs.map((tx) => (
              <TransactionRow tx={tx} categories={catMap} goals={data.goals} tontines={data.tontines}
                onClick={() => ui.open({ kind: 'tx', draft: tx })} />
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
