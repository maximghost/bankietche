import type { ComponentChildren } from 'preact';
import { useEffect, useRef } from 'preact/hooks';
import { ChevronLeft, ChevronRight, X } from 'lucide-preact';
import { useMoney } from './format';

/* --------------------------------------------------------------------------
 * Pile d'écrans superposés (feuilles et pages).
 * Chaque ouverture pousse une entrée d'historique : le bouton « retour »
 * d'Android ferme l'écran du dessus, et seulement lui.
 * ------------------------------------------------------------------------ */

const layers: { close: () => void }[] = [];
let listening = false;

function onPop() {
  const top = layers.pop();
  top?.close();
  if (layers.length === 0) document.body.classList.remove('no-scroll');
}

function useLayer(onClose: () => void) {
  const ref = useRef(onClose);
  ref.current = onClose;
  useEffect(() => {
    if (!listening) {
      window.addEventListener('popstate', onPop);
      listening = true;
    }
    const entry = { close: () => ref.current() };
    layers.push(entry);
    history.pushState({ bkLayer: layers.length }, '');
    document.body.classList.add('no-scroll');
    return () => {
      // Démonté sans passer par « retour » (cas rare) : on retire l'entrée.
      const i = layers.indexOf(entry);
      if (i >= 0) {
        layers.splice(i, 1);
        if (layers.length === 0) document.body.classList.remove('no-scroll');
      }
    };
  }, []);
}

/** Ferme l'écran superposé du dessus. */
export function closeLayer() {
  if (layers.length > 0) history.back();
}
/** @deprecated alias historique */
export const closeSheet = closeLayer;

export function Sheet(props: { title: string; onClose: () => void; children: ComponentChildren; footer?: ComponentChildren }) {
  useLayer(props.onClose);
  return (
    <div class="sheet-backdrop" onClick={(e) => e.target === e.currentTarget && closeLayer()}>
      <div class="sheet" role="dialog" aria-modal="true" aria-label={props.title}>
        <header class="sheet-head">
          <h2>{props.title}</h2>
          <button class="icon-btn" onClick={closeLayer} aria-label="Fermer"><X size={22} aria-hidden="true" /></button>
        </header>
        <div class="sheet-body">{props.children}</div>
        {props.footer && <footer class="sheet-foot">{props.footer}</footer>}
      </div>
    </div>
  );
}

/** Page plein écran (sous-pages des réglages, textes légaux…). */
export function Page(props: { title: string; onClose: () => void; children: ComponentChildren; footer?: ComponentChildren }) {
  useLayer(props.onClose);
  return (
    <div class="page" role="dialog" aria-modal="true" aria-label={props.title}>
      <header class="page-head">
        <button class="icon-btn" onClick={closeLayer} aria-label="Retour"><ChevronLeft size={24} aria-hidden="true" /></button>
        <h2>{props.title}</h2>
      </header>
      <div class="page-body">{props.children}</div>
      {props.footer && <footer class="sheet-foot">{props.footer}</footer>}
    </div>
  );
}

export function PeriodNav(props: { label: string; onPrev: () => void; onNext: () => void; canNext: boolean; sub?: string }) {
  return (
    <div class="period-nav">
      <button class="icon-btn" onClick={props.onPrev} aria-label="Période précédente"><ChevronLeft size={22} aria-hidden="true" /></button>
      <div class="period-label" aria-live="polite">
        <span>{props.label}</span>
        {props.sub && <small>{props.sub}</small>}
      </div>
      <button class="icon-btn" disabled={!props.canNext} onClick={props.onNext} aria-label="Période suivante"><ChevronRight size={22} aria-hidden="true" /></button>
    </div>
  );
}

export function Money(props: { value: number; sign?: boolean; class?: string }) {
  const fmt = useMoney();
  return <span class={`money ${props.class ?? ''}`}>{fmt(props.value, { sign: props.sign })}</span>;
}

export function Progress(props: { ratio: number; tone?: 'ok' | 'warn' | 'danger' | 'brand'; label?: string }) {
  const pct = Math.max(0, Math.min(100, props.ratio * 100));
  return (
    <div class="progress" role="progressbar" aria-label={props.label} aria-valuenow={Math.round(pct)} aria-valuemin={0} aria-valuemax={100}>
      <div class={`progress-fill tone-${props.tone ?? 'brand'}`} style={{ width: `${pct}%` }} />
    </div>
  );
}

export function budgetTone(ratio: number): 'ok' | 'warn' | 'danger' {
  return ratio >= 1 ? 'danger' : ratio >= 0.8 ? 'warn' : 'ok';
}

export function Segmented<T extends string>(props: { value: T; options: { value: T; label: string }[]; onChange: (v: T) => void; label?: string }) {
  return (
    <div class="segmented" role="radiogroup" aria-label={props.label}>
      {props.options.map((o) => (
        <button role="radio" aria-checked={o.value === props.value}
          class={o.value === props.value ? 'active' : ''} onClick={() => props.onChange(o.value)}>
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function Empty(props: { icon: ComponentChildren; title: string; text?: string; action?: ComponentChildren }) {
  return (
    <div class="empty">
      <div class="empty-icon" aria-hidden="true">{props.icon}</div>
      <p class="empty-title">{props.title}</p>
      {props.text && <p class="empty-text">{props.text}</p>}
      {props.action}
    </div>
  );
}

export function Field(props: { label: string; hint?: string; error?: boolean; children: ComponentChildren }) {
  return (
    <label class="field">
      <span class="field-label">{props.label}</span>
      {props.children}
      {props.hint && <span class={`field-hint ${props.error ? 'neg' : ''}`}>{props.hint}</span>}
    </label>
  );
}

export function Switch(props: { checked: boolean; onChange: (v: boolean) => void; label: string; description?: string }) {
  return (
    <label class="switch">
      <span class="switch-text">
        <span>{props.label}</span>
        {props.description && <small>{props.description}</small>}
      </span>
      <input type="checkbox" role="switch" checked={props.checked} onChange={(e) => props.onChange(e.currentTarget.checked)} />
      <span class="switch-track" aria-hidden="true"><span class="switch-thumb" /></span>
    </label>
  );
}

/** Ligne de liste des réglages. */
export function ListRow(props: {
  icon?: ComponentChildren; label: string; value?: string; onClick?: () => void; danger?: boolean; external?: boolean;
}) {
  return (
    <button class={`list-row ${props.danger ? 'danger' : ''}`} onClick={props.onClick}>
      {props.icon && <span class="list-icon" aria-hidden="true">{props.icon}</span>}
      <span class="list-label">{props.label}</span>
      {props.value && <span class="list-value">{props.value}</span>}
      <ChevronRight size={18} class="list-chevron" aria-hidden="true" />
    </button>
  );
}

export function ListGroup(props: { title?: string; children: ComponentChildren; footer?: string }) {
  return (
    <section class="list-group">
      {props.title && <h3 class="list-title">{props.title}</h3>}
      <div class="list-card">{props.children}</div>
      {props.footer && <p class="list-footer">{props.footer}</p>}
    </section>
  );
}
