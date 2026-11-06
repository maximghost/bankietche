import { useState } from 'preact/hooks';
import { formatShortDate } from '../domain/dates';
import { formatPeriod, PERIOD_KINDS, periodAt, sanitizePeriodConfig, type PeriodConfig, type PeriodKind } from '../domain/period';
import { Field } from './components';

const WEEK_DAYS = [
  { v: 1, label: 'Lundi' }, { v: 2, label: 'Mardi' }, { v: 3, label: 'Mercredi' }, { v: 4, label: 'Jeudi' },
  { v: 5, label: 'Vendredi' }, { v: 6, label: 'Samedi' }, { v: 0, label: 'Dimanche' },
];

/** Choix de la période de gestion (utilisé dans l'assistant et les réglages). */
export function PeriodPicker(props: { value: PeriodConfig; onChange: (c: PeriodConfig) => void; today: string }) {
  const c = props.value;
  const set = (patch: Partial<PeriodConfig>) => props.onChange(sanitizePeriodConfig({ ...c, ...patch }));
  const [lenText, setLenText] = useState(String(c.customLength));
  const preview = periodAt(c, props.today);

  return (
    <div class="option-list">
      <div class="option-list" role="radiogroup" aria-label="Période de gestion">
        {PERIOD_KINDS.map((k) => (
          <button class="option" role="radio" aria-checked={c.kind === k.kind}
            onClick={() => set({ kind: k.kind as PeriodKind, customStart: c.kind !== 'libre' && k.kind === 'libre' ? props.today : c.customStart })}>
            <span class="option-radio" aria-hidden="true" />
            <span><span class="option-title">{k.label}</span><br /><span class="option-desc">{k.description}</span></span>
          </button>
        ))}
      </div>

      {c.kind === 'semaine' && (
        <Field label="La semaine commence le">
          <select value={String(c.weekStart)} onChange={(e) => set({ weekStart: Number(e.currentTarget.value) })}>
            {WEEK_DAYS.map((d) => <option value={String(d.v)}>{d.label}</option>)}
          </select>
        </Field>
      )}
      {c.kind === 'mois' && (
        <Field label="Le mois de gestion commence le" hint="Ex. 25 si ton argent arrive le 25 de chaque mois.">
          <select value={String(c.monthStartDay)} onChange={(e) => set({ monthStartDay: Number(e.currentTarget.value) })}>
            {Array.from({ length: 28 }, (_, i) => i + 1).map((d) => <option value={String(d)}>{d === 1 ? '1er du mois' : `${d} du mois`}</option>)}
          </select>
        </Field>
      )}
      {c.kind === 'libre' && (
        <div class="grid-2">
          <Field label="Début de la période">
            <input type="date" value={c.customStart} onInput={(e) => e.currentTarget.value && set({ customStart: e.currentTarget.value })} />
          </Field>
          <Field label="Durée (jours)" hint="Entre 2 et 366 jours" error={!(Number(lenText) >= 2 && Number(lenText) <= 366)}>
            <input inputMode="numeric" value={lenText} onInput={(e) => {
              const v = e.currentTarget.value.replace(/\D/g, '').slice(0, 3);
              setLenText(v);
              const n = Number(v);
              if (n >= 2 && n <= 366) set({ customLength: n });
            }} />
          </Field>
        </div>
      )}
      <p class="info-box" aria-live="polite">
        Période en cours : <b>{formatPeriod(c, preview, props.today)}</b>
        {c.kind !== 'jour' && <> (du {formatShortDate(preview.start)} au {formatShortDate(preview.end)})</>}
      </p>
    </div>
  );
}
