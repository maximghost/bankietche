import type { Category, Goal, Tontine, Transaction } from '../domain/types';
import { PAYMENT_METHODS } from '../domain/types';
import { Money } from './components';
import { useMoney } from './format';
import { IconBadge } from './icon-registry';

const methodInfo = new Map(PAYMENT_METHODS.map((m) => [m.id, m]));
const TYPE_WORD = { depense: 'Dépense', revenu: 'Entrée', epargne: 'Épargne' } as const;

export function TransactionRow(props: {
  tx: Transaction;
  categories: Map<string, Category>;
  goals: Goal[];
  tontines: Tontine[];
  onClick: () => void;
}) {
  const fmt = useMoney();
  const { tx } = props;
  const cat = tx.categoryId ? props.categories.get(tx.categoryId) : undefined;
  const goal = tx.goalId ? props.goals.find((g) => g.id === tx.goalId) : undefined;
  const tontine = tx.tontineId ? props.tontines.find((t) => t.id === tx.tontineId) : undefined;

  const icon = tx.type === 'epargne' ? (goal?.icon ?? 'piggy') : (cat?.icon ?? 'tag');
  const title = tx.type === 'epargne'
    ? (goal ? goal.name : 'Épargne libre')
    : tontine ? `${tx.type === 'depense' ? 'Cotisation' : 'Ramassage'} · ${tontine.name}` : (cat?.name ?? 'Sans catégorie');
  const method = methodInfo.get(tx.method);
  const sign = tx.type === 'revenu' ? 1 : -1;
  const a11y = `${TYPE_WORD[tx.type]}, ${title}, ${fmt(tx.amount)}, ${method?.label ?? ''}${tx.note ? `, ${tx.note}` : ''}. Modifier`;

  return (
    <button class="tx-row" onClick={props.onClick} aria-label={a11y}>
      <IconBadge name={icon} tint={tx.type === 'epargne' ? 'violet' : undefined} />
      <span class="tx-main" aria-hidden="true">
        <span class="tx-title">{title}</span>
        <span class="tx-sub">
          <span class="dot" style={{ background: method?.color }} />
          {method?.short}{tx.note ? ` · ${tx.note}` : ''}
        </span>
      </span>
      <span aria-hidden="true">
        <Money value={sign * tx.amount} sign class={tx.type === 'revenu' ? 'pos' : tx.type === 'epargne' ? 'save' : 'neg'} />
      </span>
    </button>
  );
}
