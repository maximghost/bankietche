import { useMemo, useState } from 'preact/hooks';
import { today } from '../../domain/dates';
import { formatInput, parseAmount } from '../../domain/money';
import type { PaymentMethod, Transaction, TxType } from '../../domain/types';
import { PAYMENT_METHODS } from '../../domain/types';
import { useStore } from '../../state/store';
import { Trash2 } from 'lucide-preact';
import { closeLayer, Field, Segmented, Sheet } from '../components';
import { IconBadge } from '../icon-registry';

const QUICK = [100, 500, 1000, 5000];
const LAST_METHOD_KEY = 'bk:lastMethod';

function lastMethod(): PaymentMethod {
  try {
    const m = localStorage.getItem(LAST_METHOD_KEY) as PaymentMethod | null;
    return m && PAYMENT_METHODS.some((x) => x.id === m) ? m : 'mtn';
  } catch {
    return 'mtn';
  }
}

export type TxDraft = Partial<Transaction>;

export function TransactionSheet(props: { initial?: TxDraft; onClose: () => void }) {
  const { data, saveTransaction, deleteTransaction } = useStore();
  const init = props.initial ?? {};
  const editing = Boolean(init.id);

  const [type, setType] = useState<TxType>(init.type ?? 'depense');
  const [amount, setAmount] = useState(init.amount ? formatInput(String(init.amount)) : '');
  const [categoryId, setCategoryId] = useState<string | null>(init.categoryId ?? null);
  const [method, setMethod] = useState<PaymentMethod>(init.method ?? lastMethod());
  const [date, setDate] = useState(init.date ?? today());
  const [note, setNote] = useState(init.note ?? '');
  const [goalId, setGoalId] = useState<string | undefined>(init.goalId);
  const [busy, setBusy] = useState(false);
  const tontineId = init.tontineId;

  const categories = useMemo(() => {
    if (type === 'epargne') return [];
    return data.categories.filter((c) =>
      c.kind === type && ((!c.archived && !c.system) || c.id === categoryId));
  }, [data.categories, type, categoryId]);

  const goals = data.goals.filter((g) => !g.archived || g.id === goalId);
  const value = parseAmount(amount);
  const valid = value !== null && date !== '' && (type === 'epargne' || categoryId !== null);

  const changeType = (t: TxType) => {
    setType(t);
    if (t === 'epargne') setCategoryId(null);
    else if (!data.categories.some((c) => c.id === categoryId && c.kind === t)) setCategoryId(null);
  };

  const submit = async () => {
    if (!valid || busy) return;
    setBusy(true);
    try {
      localStorage.setItem(LAST_METHOD_KEY, method);
    } catch { /* stockage indisponible : sans conséquence */ }
    await saveTransaction({
      id: init.id,
      createdAt: init.createdAt,
      type,
      amount: value!,
      categoryId: type === 'epargne' ? null : categoryId,
      method,
      date,
      note: note.trim() || undefined,
      goalId: type === 'epargne' ? goalId : undefined,
      tontineId: type === 'epargne' ? undefined : tontineId,
    });
    closeLayer();
  };

  const remove = async () => {
    if (!init.id || !confirm('Supprimer cette opération ?')) return;
    await deleteTransaction(init.id);
    closeLayer();
  };

  const title = editing ? 'Modifier l’opération' : 'Nouvelle opération';

  return (
    <Sheet title={title} onClose={props.onClose} footer={
      <div class="row gap">
        {editing && <button class="btn btn-ghost danger" onClick={remove} aria-label="Supprimer l’opération"><Trash2 size={20} aria-hidden="true" /></button>}
        <button class="btn btn-primary grow" disabled={!valid || busy} onClick={submit}>
          {editing ? 'Enregistrer' : 'Ajouter'}
        </button>
      </div>
    }>
      {!tontineId && (
        <Segmented<TxType> value={type} onChange={changeType} label="Type d’opération" options={[
          { value: 'depense', label: 'Dépense' },
          { value: 'revenu', label: 'Entrée' },
          { value: 'epargne', label: 'Épargne' },
        ]} />
      )}

      <div class={`amount-input type-${type}`}>
        <input
          inputMode="numeric" autoComplete="off" placeholder="0" aria-label="Montant en francs CFA"
          value={amount} autoFocus={!editing}
          onInput={(e) => setAmount(formatInput(e.currentTarget.value))}
        />
        <span>F</span>
      </div>
      <div class="chips center">
        {QUICK.map((q) => (
          <button class="chip" onClick={() => setAmount(formatInput(String((value ?? 0) + q)))} aria-label={`Ajouter ${q} francs`}>
            +{formatInput(String(q))}
          </button>
        ))}
      </div>

      {type === 'epargne' ? (
        <section class="form-section">
          <h3>Pour quel objectif ?</h3>
          <div class="chips">
            <button class="chip" aria-pressed={!goalId} onClick={() => setGoalId(undefined)}>Épargne libre</button>
            {goals.map((g) => (
              <button class="chip" aria-pressed={goalId === g.id} onClick={() => setGoalId(g.id)}>
                <IconBadge name={g.icon} size="sm" tint="violet" /> {g.name}
              </button>
            ))}
          </div>
        </section>
      ) : (
        <section class="form-section">
          <h3 id="cat-h">Catégorie</h3>
          <div class="cat-grid" role="group" aria-labelledby="cat-h">
            {categories.map((c) => (
              <button class="cat-tile" aria-pressed={categoryId === c.id} onClick={() => setCategoryId(c.id)}>
                <IconBadge name={c.icon} />
                <span class="cat-name">{c.name}</span>
              </button>
            ))}
          </div>
        </section>
      )}

      <section class="form-section">
        <h3 id="method-h">{type === 'revenu' ? 'Reçu par' : type === 'epargne' ? 'Depuis' : 'Payé avec'}</h3>
        <div class="chips" role="group" aria-labelledby="method-h">
          {PAYMENT_METHODS.map((m) => (
            <button class="chip" aria-pressed={method === m.id} onClick={() => setMethod(m.id)}>
              <span class="dot" style={{ background: m.color }} />{m.label}
            </button>
          ))}
        </div>
      </section>

      <div class="grid-2">
        <Field label="Date">
          <input type="date" value={date} max="2100-12-31" onInput={(e) => setDate(e.currentTarget.value)} />
        </Field>
        <Field label="Note (facultatif)">
          <input type="text" maxLength={60} placeholder="ex. amiwo avec Koffi" value={note}
            onInput={(e) => setNote(e.currentTarget.value)} />
        </Field>
      </div>
    </Sheet>
  );
}
