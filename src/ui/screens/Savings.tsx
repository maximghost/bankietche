import { Handshake, Plus, Target } from 'lucide-preact';
import { useState } from 'preact/hooks';
import { CAT_TONTINE_COTISATION, CAT_TONTINE_RAMASSAGE } from '../../domain/defaults';
import { formatDayLabel, formatShortDate } from '../../domain/dates';
import { goalStatus } from '../../domain/goals';
import { percent } from '../../domain/money';
import { perPeriodPhrase } from '../../domain/period';
import { tontineStatus } from '../../domain/tontine';
import { FREQUENCY_LABELS } from '../../domain/types';
import { useStore } from '../../state/store';
import { Empty, Progress, Segmented } from '../components';
import { useMoney } from '../format';
import { IconBadge } from '../icon-registry';
import { useUI } from '../ui-context';

type View = 'goals' | 'tontines';

export function SavingsScreen() {
  const [view, setView] = useState<View>('goals');
  const [showArchived, setShowArchived] = useState(false);
  return (
    <div class="screen">
      <Segmented<View> value={view} onChange={setView} label="Rubrique" options={[
        { value: 'goals', label: 'Objectifs' },
        { value: 'tontines', label: 'Tontines' },
      ]} />
      {view === 'goals' ? <Goals showArchived={showArchived} /> : <Tontines showArchived={showArchived} />}
      <button class="btn-link" onClick={() => setShowArchived(!showArchived)}>
        {showArchived ? 'Masquer les archives' : 'Voir les archives'}
      </button>
    </div>
  );
}

function Goals({ showArchived }: { showArchived: boolean }) {
  const { data, settings } = useStore();
  const ui = useUI();
  const fmt = useMoney();
  const goals = data.goals.filter((g) => g.archived === showArchived);

  return (
    <>
      {goals.length === 0 && (
        <Empty icon={<Target size={30} />} title={showArchived ? 'Aucun objectif archivé' : 'Aucun objectif pour l’instant'}
          text={showArchived ? undefined : 'Un téléphone, des frais d’inscription, un projet ? Fixe un montant et suis ta progression.'} />
      )}
      {goals.map((g) => {
        const s = goalStatus(g, data.transactions, settings.period, ui.today);
        return (
          <article class="card" aria-label={g.name}>
            <button class="row card-head" onClick={() => ui.open({ kind: 'goal', goal: g })} aria-label={`Modifier l’objectif ${g.name}`}>
              <IconBadge name={g.icon} size="lg" tint="violet" />
              <span class="grow left"><b>{g.name}</b><br />
                <small class="muted">{g.deadline ? `Avant le ${formatShortDate(g.deadline)}` : 'Sans date limite'}</small></span>
              <span class={s.reached ? 'pos' : 'muted'}><b>{percent(s.saved, g.target)} %</b></span>
            </button>
            <Progress ratio={s.ratio} tone={s.reached ? 'ok' : 'brand'} label="Progression" />
            <div class="row between small">
              <span><b>{fmt(s.saved)}</b> sur {fmt(g.target)}</span>
              {s.reached ? <span class="pos"><b>Objectif atteint</b></span>
                : s.perPeriod ? <span class="muted">{fmt(s.perPeriod)} {perPeriodPhrase(settings.period)}</span>
                : <span class="muted">Reste {fmt(s.remaining)}</span>}
            </div>
            {!g.archived && !s.reached && (
              <button class="btn btn-soft block" onClick={() => ui.open({ kind: 'tx', draft: { type: 'epargne', goalId: g.id } })}>
                Mettre de côté
              </button>
            )}
          </article>
        );
      })}
      {!showArchived && (
        <button class="btn btn-primary block" onClick={() => ui.open({ kind: 'goal' })}><Plus size={20} aria-hidden="true" /> Nouvel objectif</button>
      )}
    </>
  );
}

function Tontines({ showArchived }: { showArchived: boolean }) {
  const { data } = useStore();
  const ui = useUI();
  const fmt = useMoney();
  const tontines = data.tontines.filter((t) => t.archived === showArchived);

  return (
    <>
      {tontines.length === 0 && (
        <Empty icon={<Handshake size={30} />} title={showArchived ? 'Aucune tontine archivée' : 'Aucune tontine enregistrée'}
          text={showArchived ? undefined : 'Ajoute tes tontines pour ne plus oublier une cotisation et savoir quand tu ramasses.'} />
      )}
      {tontines.map((t) => {
        const s = tontineStatus(t, data.transactions, ui.today);
        return (
          <article class="card" aria-label={t.name}>
            <button class="row card-head" onClick={() => ui.open({ kind: 'tontine', tontine: t })} aria-label={`Modifier la tontine ${t.name}`}>
              <IconBadge name="handshake" size="lg" tint="teal" />
              <span class="grow left"><b>{t.name}</b><br />
                <small class="muted">{fmt(t.amount)} · {FREQUENCY_LABELS[t.frequency].toLowerCase()} · {t.members} membres</small></span>
              {s.late > 0 && <span class="badge badge-danger">{s.late} en retard</span>}
            </button>
            <Progress ratio={s.paidCount / t.members} tone={s.late > 0 ? 'warn' : 'brand'} label="Cotisations payées" />
            <div class="row between small">
              <span>{s.paidCount}/{t.members} cotisations payées</span>
              <span class="muted">{s.nextDue ? `Prochaine : ${formatDayLabel(s.nextDue, ui.today)}` : 'Tout est payé'}</span>
            </div>
            <div class={`collect ${s.collected ? 'done' : s.daysToCollect <= 0 ? 'now' : ''}`}>
              {s.collected
                ? <>Ramassé : <b>{fmt(s.collectedAmount)}</b></>
                : <>Mon ramassage (tour {t.myTurn}) : <b>{fmt(s.pot)}</b> · {s.daysToCollect > 0
                    ? `dans ${s.daysToCollect} jour${s.daysToCollect > 1 ? 's' : ''}` : formatDayLabel(s.myCollectDate, ui.today)}</>}
            </div>
            {!t.archived && (
              <div class="row gap">
                {s.nextDue && (
                  <button class="btn btn-soft grow" onClick={() => ui.open({ kind: 'tx', draft: {
                    type: 'depense', amount: t.amount, categoryId: CAT_TONTINE_COTISATION, tontineId: t.id,
                  } })}>J’ai cotisé</button>
                )}
                {!s.collected && (
                  <button class="btn btn-soft grow" onClick={() => ui.open({ kind: 'tx', draft: {
                    type: 'revenu', amount: s.pot, categoryId: CAT_TONTINE_RAMASSAGE, tontineId: t.id,
                  } })}>J’ai ramassé</button>
                )}
              </div>
            )}
          </article>
        );
      })}
      {!showArchived && (
        <button class="btn btn-primary block" onClick={() => ui.open({ kind: 'tontine' })}><Plus size={20} aria-hidden="true" /> Nouvelle tontine</button>
      )}
    </>
  );
}
