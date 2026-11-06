import { useState } from 'preact/hooks';
import { Trash2 } from 'lucide-preact';
import { today } from '../../domain/dates';
import { formatF, formatInput, parseAmount } from '../../domain/money';
import type { Category, CategoryKind, Frequency, Goal, Tontine } from '../../domain/types';
import { FREQUENCY_LABELS } from '../../domain/types';
import { useStore } from '../../state/store';
import { closeLayer, Field, Segmented, Sheet, Switch } from '../components';
import { CATEGORY_ICON_KEYS, GOAL_ICON_KEYS, ICONS, IconOf } from '../icon-registry';

function IconPicker(props: { value: string; options: string[]; onChange: (k: string) => void }) {
  return (
    <div class="form-section">
      <h3 id="icon-h">Icône</h3>
      <div class="icon-grid" role="group" aria-labelledby="icon-h">
        {props.options.map((k) => (
          <button class="icon-pick" aria-pressed={props.value === k} onClick={() => props.onChange(k)} aria-label={ICONS[k]?.label ?? k}>
            <IconOf name={k} size={22} />
          </button>
        ))}
      </div>
    </div>
  );
}

function AmountField(props: { label: string; value: string; onChange: (v: string) => void; hint?: string }) {
  return (
    <Field label={props.label} hint={props.hint}>
      <div class="input-suffix">
        <input inputMode="numeric" placeholder="0" value={props.value}
          onInput={(e) => props.onChange(formatInput(e.currentTarget.value))} />
        <span>F</span>
      </div>
    </Field>
  );
}

/* ------------------------------------------------------------------ */

export function GoalSheet(props: { goal?: Goal; onClose: () => void }) {
  const { saveGoal, deleteGoal } = useStore();
  const g = props.goal;
  const [name, setName] = useState(g?.name ?? '');
  const [icon, setIcon] = useState(g?.icon ?? GOAL_ICON_KEYS[0]);
  const [target, setTarget] = useState(g ? formatInput(String(g.target)) : '');
  const [deadline, setDeadline] = useState(g?.deadline ?? '');
  const value = parseAmount(target);
  const valid = name.trim().length > 0 && value !== null;

  const submit = async () => {
    if (!valid) return;
    await saveGoal({
      id: g?.id, createdAt: g?.createdAt, archived: g?.archived ?? false,
      name: name.trim(), icon, target: value!, deadline: deadline || undefined,
    });
    closeLayer();
  };
  const remove = async () => {
    if (!g || !confirm(`Supprimer l’objectif « ${g.name} » et tous ses versements ?`)) return;
    await deleteGoal(g.id);
    closeLayer();
  };

  return (
    <Sheet title={g ? 'Modifier l’objectif' : 'Nouvel objectif'} onClose={props.onClose} footer={
      <div class="row gap">
        {g && <button class="btn btn-ghost danger" onClick={remove} aria-label="Supprimer"><Trash2 size={20} aria-hidden="true" /></button>}
        <button class="btn btn-primary grow" disabled={!valid} onClick={submit}>{g ? 'Enregistrer' : 'Créer l’objectif'}</button>
      </div>
    }>
      <Field label="Nom de l’objectif">
        <input type="text" maxLength={40} placeholder="ex. Nouveau téléphone" value={name}
          onInput={(e) => setName(e.currentTarget.value)} />
      </Field>
      <IconPicker value={icon} options={GOAL_ICON_KEYS} onChange={setIcon} />
      <div class="grid-2">
        <AmountField label="Montant visé" value={target} onChange={setTarget} />
        <Field label="Pour quand ? (facultatif)">
          <input type="date" min={today()} value={deadline} onInput={(e) => setDeadline(e.currentTarget.value)} />
        </Field>
      </div>
      {g && (
        <div class="list-card">
          <Switch checked={g.archived} label="Archiver cet objectif" description="Atteint ou abandonné : il disparaît de la liste principale."
            onChange={async (v) => { await saveGoal({ ...g, archived: v }); closeLayer(); }} />
        </div>
      )}
    </Sheet>
  );
}

/* ------------------------------------------------------------------ */

export function TontineSheet(props: { tontine?: Tontine; onClose: () => void }) {
  const { saveTontine, deleteTontine } = useStore();
  const t = props.tontine;
  const [name, setName] = useState(t?.name ?? '');
  const [amount, setAmount] = useState(t ? formatInput(String(t.amount)) : '');
  const [frequency, setFrequency] = useState<Frequency>(t?.frequency ?? 'semaine');
  const [startDate, setStartDate] = useState(t?.startDate ?? today());
  const [members, setMembers] = useState(String(t?.members ?? 10));
  const [myTurn, setMyTurn] = useState(String(t?.myTurn ?? 1));

  const value = parseAmount(amount);
  const nMembers = Number(members);
  const nTurn = Number(myTurn);
  const membersOk = Number.isInteger(nMembers) && nMembers >= 2 && nMembers <= 200;
  const turnOk = Number.isInteger(nTurn) && nTurn >= 1 && nTurn <= nMembers;
  const valid = name.trim().length > 0 && value !== null && startDate !== '' && membersOk && turnOk;

  const submit = async () => {
    if (!valid) return;
    await saveTontine({
      id: t?.id, createdAt: t?.createdAt, archived: t?.archived ?? false,
      name: name.trim(), amount: value!, frequency, startDate, members: nMembers, myTurn: nTurn,
    });
    closeLayer();
  };
  const remove = async () => {
    if (!t || !confirm(`Supprimer la tontine « ${t.name} » et toutes ses cotisations enregistrées ?`)) return;
    await deleteTontine(t.id);
    closeLayer();
  };

  return (
    <Sheet title={t ? 'Modifier la tontine' : 'Nouvelle tontine'} onClose={props.onClose} footer={
      <div class="row gap">
        {t && <button class="btn btn-ghost danger" onClick={remove} aria-label="Supprimer"><Trash2 size={20} aria-hidden="true" /></button>}
        <button class="btn btn-primary grow" disabled={!valid} onClick={submit}>{t ? 'Enregistrer' : 'Ajouter la tontine'}</button>
      </div>
    }>
      <Field label="Nom">
        <input type="text" maxLength={40} placeholder="ex. Tontine des amis de la fac" value={name}
          onInput={(e) => setName(e.currentTarget.value)} />
      </Field>
      <AmountField label="Ma cotisation" value={amount} onChange={setAmount} />
      <Segmented<Frequency> value={frequency} onChange={setFrequency} label="Fréquence des cotisations"
        options={(Object.keys(FREQUENCY_LABELS) as Frequency[]).map((f) => ({ value: f, label: FREQUENCY_LABELS[f] }))} />
      <div class="grid-2">
        <Field label="Première cotisation">
          <input type="date" value={startDate} onInput={(e) => setStartDate(e.currentTarget.value)} />
        </Field>
        <Field label="Nombre de membres" hint={!membersOk ? 'Entre 2 et 200' : undefined} error={!membersOk}>
          <input inputMode="numeric" value={members} onInput={(e) => setMembers(e.currentTarget.value.replace(/\D/g, ''))} />
        </Field>
      </div>
      <Field label="Mon tour de ramassage" hint={!turnOk ? `Entre 1 et ${membersOk ? nMembers : '…'}` : '1 = je ramasse en premier'} error={!turnOk}>
        <input inputMode="numeric" value={myTurn} onInput={(e) => setMyTurn(e.currentTarget.value.replace(/\D/g, ''))} />
      </Field>
      {valid && (
        <p class="info-box">
          Tu cotises <b>{formatF(value!)}</b> {FREQUENCY_LABELS[frequency].toLowerCase()} pendant {nMembers} tours,
          et tu ramasses <b>{formatF(value! * nMembers)}</b> au tour n° {nTurn}.
        </p>
      )}
      {t && (
        <div class="list-card">
          <Switch checked={t.archived} label="Archiver cette tontine" description="Tontine terminée : elle disparaît de la liste principale."
            onChange={async (v) => { await saveTontine({ ...t, archived: v }); closeLayer(); }} />
        </div>
      )}
    </Sheet>
  );
}

/* ------------------------------------------------------------------ */

export function CategorySheet(props: { category?: Category; kind?: CategoryKind; onClose: () => void }) {
  const { saveCategory } = useStore();
  const c = props.category;
  const [name, setName] = useState(c?.name ?? '');
  const [icon, setIcon] = useState(c?.icon ?? 'tag');
  const [kind, setKind] = useState<CategoryKind>(c?.kind ?? props.kind ?? 'depense');
  const [archived, setArchived] = useState(c?.archived ?? false);
  const valid = name.trim().length > 0;

  const submit = async () => {
    if (!valid) return;
    await saveCategory({
      id: c?.id, order: c?.order, system: c?.system ?? false, budget: kind === 'depense' ? (c?.budget ?? 0) : 0,
      name: name.trim(), icon, kind, archived,
    });
    closeLayer();
  };

  return (
    <Sheet title={c ? 'Modifier la catégorie' : 'Nouvelle catégorie'} onClose={props.onClose} footer={
      <button class="btn btn-primary block" disabled={!valid} onClick={submit}>{c ? 'Enregistrer' : 'Créer la catégorie'}</button>
    }>
      {!c && (
        <Segmented<CategoryKind> value={kind} onChange={setKind} label="Type de catégorie" options={[
          { value: 'depense', label: 'Dépense' }, { value: 'revenu', label: 'Entrée' },
        ]} />
      )}
      <Field label="Nom">
        <input type="text" maxLength={30} placeholder="ex. Carburant" value={name} onInput={(e) => setName(e.currentTarget.value)} />
      </Field>
      <IconPicker value={icon} options={CATEGORY_ICON_KEYS} onChange={setIcon} />
      {c && !c.system && (
        <div class="list-card">
          <Switch checked={archived} onChange={setArchived} label="Masquer cette catégorie" description="Elle ne sera plus proposée ; l’historique est conservé." />
        </div>
      )}
    </Sheet>
  );
}
