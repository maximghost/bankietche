/**
 * Relevé PDF aux couleurs de Bankiétché (jsPDF, chargé à la demande).
 * Tout est généré sur le téléphone : aucune donnée n'est envoyée.
 */
import { jsPDF } from 'jspdf';
import { formatShortDate, toISODate } from '../domain/dates';
import { formatF } from '../domain/money';
import { FREQUENCY_LABELS } from '../domain/types';
import type { ReportData } from './report';

const C = {
  brand: '#6D28D9', brandDeep: '#4C1D95', brandSoft: '#EDE9FE', gold: '#FBBF24',
  text: '#17142A', muted: '#5F5B73', line: '#E4E1EE', zebra: '#F7F5FC',
  pos: '#137333', neg: '#C42B2B', save: '#6D28D9', ok: '#22A355', warn: '#E59500', danger: '#DC2626', track: '#ECEAF3',
};
const PAGE_W = 210;
const PAGE_H = 297;
const M = 14; // marge
const W = PAGE_W - 2 * M;
const BOTTOM = PAGE_H - 18;

/** Les polices standard du PDF ne couvrent que le latin occidental : on normalise les caractères spéciaux. */
function t(s: string): string {
  return s.replace(/[  ]/g, ' ').replace(/−/g, '-').replace(/[‘’]/g, "'").replace(/[“”]/g, '"');
}
const money = (n: number, sign = false) => t(formatF(n, { sign }));
const pct = (r: number) => `${Math.round(r * 100)} %`;

function toneColor(ratio: number): string {
  return ratio >= 1 ? C.danger : ratio >= 0.8 ? C.warn : C.ok;
}

async function loadLogo(): Promise<Uint8Array | null> {
  try {
    const res = await fetch(`${import.meta.env.BASE_URL}icons/icon-192.png`);
    return new Uint8Array(await res.arrayBuffer());
  } catch {
    return null;
  }
}

export async function renderReportPdf(r: ReportData): Promise<Blob> {
  const doc = new jsPDF({ unit: 'mm', format: 'a4', compress: true });
  const logo = await loadLogo();
  // Date et heure d'édition, en heure locale du téléphone.
  const g = r.generatedAt;
  const edited = `Édité le ${formatShortDate(toISODate(g))} à ${String(g.getHours()).padStart(2, '0')}:${String(g.getMinutes()).padStart(2, '0')}`;

  doc.setProperties({
    title: t(`Bankiétché — ${r.title} — ${r.periodLabel}`),
    subject: t(`Relevé du ${formatShortDate(r.period.start)} au ${formatShortDate(r.period.end)}`),
    author: t(r.name || 'Utilisateur Bankiétché'),
    creator: t('Bankiétché — Ghost.Technologies'),
  });

  const font = (size: number, style: 'normal' | 'bold' = 'normal', color = C.text) => {
    doc.setFont('helvetica', style);
    doc.setFontSize(size);
    doc.setTextColor(color);
  };
  const fit = (s: string, maxW: number) => {
    let out = t(s);
    if (doc.getTextWidth(out) <= maxW) return out;
    while (out.length > 1 && doc.getTextWidth(`${out}…`) > maxW) out = out.slice(0, -1);
    return `${out.trimEnd()}…`;
  };

  /* ---------- En-tête ---------- */
  const header = (first: boolean) => {
    const h = first ? 36 : 18;
    doc.setFillColor(C.brand);
    doc.rect(0, 0, PAGE_W, h, 'F');
    doc.setFillColor(C.gold);
    doc.rect(0, h, PAGE_W, 1.2, 'F');
    if (first) {
      if (logo) doc.addImage(logo, 'PNG', M, 8, 20, 20);
      font(21, 'bold', '#FFFFFF');
      doc.text(t('Bankiétché'), M + 25, 17);
      font(10, 'normal', '#EDE9FE');
      doc.text(t(`${r.title} · une appli Ghost.Technologies`), M + 25, 24);
      font(12, 'bold', '#FFFFFF');
      doc.text(t(r.periodLabel), PAGE_W - M, 14, { align: 'right' });
      font(9, 'normal', '#EDE9FE');
      doc.text(t(`Du ${formatShortDate(r.period.start)} au ${formatShortDate(r.period.end)}`), PAGE_W - M, 20, { align: 'right' });
      doc.text(t(edited), PAGE_W - M, 25.5, { align: 'right' });
      return h + 9;
    }
    if (logo) doc.addImage(logo, 'PNG', M, 4, 10, 10);
    font(11, 'bold', '#FFFFFF');
    doc.text(t('Bankiétché'), M + 13, 11);
    font(9, 'normal', '#EDE9FE');
    doc.text(t(`${r.title} · ${r.periodLabel}`), PAGE_W - M, 11, { align: 'right' });
    return h + 9;
  };

  let y = header(true);
  const ensure = (needed: number) => {
    if (y + needed > BOTTOM) {
      doc.addPage();
      y = header(false);
    }
  };
  const section = (title: string, needed = 20) => {
    y += 3;
    ensure(needed + 10);
    font(11, 'bold', C.brandDeep);
    doc.text(t(title.toUpperCase()), M, y);
    doc.setDrawColor(C.line);
    doc.setLineWidth(0.3);
    doc.line(M + doc.getTextWidth(t(title.toUpperCase())) + 3, y - 1.2, PAGE_W - M, y - 1.2);
    y += 6;
  };
  const bar = (x: number, yy: number, w: number, ratio: number, color: string, h = 3.2) => {
    doc.setFillColor(C.track);
    doc.roundedRect(x, yy, w, h, h / 2, h / 2, 'F');
    const fw = Math.max(0, Math.min(1, ratio)) * w;
    if (fw > 0.5) {
      doc.setFillColor(color);
      doc.roundedRect(x, yy, Math.max(fw, h), h, h / 2, h / 2, 'F');
    }
  };

  /* ---------- Identité ---------- */
  font(9.5, 'normal', C.muted);
  const who = [r.name ? `Titulaire : ${r.name}` : null, `Gestion : ${r.periodKind}`].filter(Boolean).join('   ·   ');
  doc.text(t(who), M, y);
  y += 6;

  /* ---------- Indicateurs ---------- */
  const s = r.summary;
  const kpis: { label: string; value: string; color: string; sub?: string }[] = [
    { label: 'Entrées', value: money(s.income), color: C.pos },
    { label: 'Dépenses', value: money(s.expense), color: C.neg,
      sub: r.change !== null ? `${r.change > 0 ? '+' : '-'}${Math.abs(r.change)} % vs période préc.` : undefined },
    { label: 'Épargné', value: money(s.saving), color: C.save },
    { label: 'Disponible', value: money(s.available), color: s.available < 0 ? C.neg : C.text, sub: 'solde fin de période' },
  ];
  const kw = (W - 3 * 4) / 4;
  kpis.forEach((k, i) => {
    const x = M + i * (kw + 4);
    doc.setFillColor(C.brandSoft);
    doc.roundedRect(x, y, kw, 22, 3, 3, 'F');
    font(8.5, 'bold', C.muted);
    doc.text(t(k.label), x + 4, y + 6);
    font(13, 'bold', k.color);
    doc.text(fit(k.value, kw - 8), x + 4, y + 13.5);
    if (k.sub) {
      font(7, 'normal', C.muted);
      doc.text(fit(k.sub, kw - 8), x + 4, y + 18.5);
    }
  });
  y += 30;

  /* ---------- Budget ---------- */
  const spent = s.byCategory.filter((l) => l.spent > 0 || l.budget > 0);
  section(s.totalBudget > 0 ? 'Budget de la période' : 'Dépenses par catégorie', 24);
  if (s.totalBudget > 0) {
    const ratio = s.expense / s.totalBudget;
    font(10, 'bold');
    doc.text(t('Budget utilisé'), M, y);
    font(10, 'normal', C.muted);
    doc.text(t(`${money(s.expense)} sur ${money(s.totalBudget)} · ${pct(ratio)}`), PAGE_W - M, y, { align: 'right' });
    y += 2.5;
    bar(M, y, W, ratio, toneColor(ratio), 4.5);
    y += 9;
    font(9, 'normal', s.remaining < 0 ? C.neg : C.muted);
    doc.text(t(s.remaining < 0 ? `Dépassement : ${money(-s.remaining)}` : `Reste : ${money(s.remaining)}`), M, y);
    y += 7;
  }
  if (spent.length === 0) {
    font(9.5, 'normal', C.muted);
    doc.text(t('Aucune dépense sur cette période.'), M, y);
    y += 8;
  }
  for (const l of spent) {
    ensure(11);
    const ratio = l.budget > 0 ? l.ratio : s.expense > 0 ? l.spent / s.expense : 0;
    font(9.5, 'bold');
    doc.text(fit(l.category.name, 90), M, y);
    font(9.5, 'normal', C.muted);
    const right = l.budget > 0 ? `${money(l.spent)} / ${money(l.budget)} · ${pct(l.ratio)}` : `${money(l.spent)} · ${pct(ratio)} des dépenses`;
    doc.text(t(right), PAGE_W - M, y, { align: 'right' });
    y += 2.2;
    bar(M, y, W, ratio, l.budget > 0 ? toneColor(l.ratio) : C.brand);
    y += 8;
  }

  /* ---------- Moyens de paiement ---------- */
  if (r.methods.length > 0 && s.expense > 0) {
    section('Moyens de paiement', 18);
    let x = M;
    for (const m of r.methods) {
      const w = (m.amount / s.expense) * W;
      doc.setFillColor(m.color);
      doc.rect(x, y, Math.max(w - 0.6, 0.6), 5, 'F');
      x += w;
    }
    y += 10;
    let lx = M;
    for (const m of r.methods) {
      const label = t(`${m.label} : ${money(m.amount)} (${pct(m.amount / s.expense)})`);
      font(8.5, 'normal', C.text);
      const w = doc.getTextWidth(label) + 9;
      if (lx + w > PAGE_W - M) { lx = M; y += 5.5; ensure(6); }
      doc.setFillColor(m.color);
      doc.circle(lx + 1.6, y - 1.2, 1.6, 'F');
      doc.text(label, lx + 4.5, y);
      lx += w;
    }
    y += 9;
  }

  /* ---------- Objectifs ---------- */
  if (r.goals.length > 0) {
    section('Objectifs d’épargne', 16);
    for (const { goal, status } of r.goals) {
      ensure(14);
      font(9.5, 'bold');
      doc.text(fit(goal.name, 95), M, y);
      font(9.5, 'normal', status.reached ? C.pos : C.muted);
      doc.text(t(`${money(status.saved)} / ${money(goal.target)} · ${pct(status.ratio)}`), PAGE_W - M, y, { align: 'right' });
      y += 2.2;
      bar(M, y, W, status.ratio, status.reached ? C.ok : C.brand);
      y += 7;
      font(8, 'normal', C.muted);
      doc.text(t(status.reached ? 'Objectif atteint'
        : goal.deadline ? `Échéance : ${formatShortDate(goal.deadline)} · reste ${money(status.remaining)}` : `Reste ${money(status.remaining)}`), M, y);
      y += 6;
    }
  }

  /* ---------- Tontines ---------- */
  if (r.tontines.length > 0) {
    section('Tontines', 16);
    for (const { tontine: tn, status } of r.tontines) {
      ensure(14);
      font(9.5, 'bold');
      doc.text(fit(tn.name, 95), M, y);
      font(9.5, 'normal', status.late > 0 ? C.neg : C.muted);
      doc.text(t(`${status.paidCount}/${tn.members} cotisations${status.late > 0 ? ` · ${status.late} en retard` : ''}`), PAGE_W - M, y, { align: 'right' });
      y += 2.2;
      bar(M, y, W, status.paidCount / tn.members, status.late > 0 ? C.warn : C.brand);
      y += 7;
      font(8, 'normal', C.muted);
      doc.text(t(`${money(tn.amount)} ${FREQUENCY_LABELS[tn.frequency].toLowerCase()} · ramassage (tour ${tn.myTurn}) le ${formatShortDate(status.myCollectDate)} : ${money(status.pot)}${status.collected ? ' · ramassé' : ''}`), M, y);
      y += 6;
    }
  }

  /* ---------- Opérations ---------- */
  section(`Opérations (${r.rows.length})`, 20);
  const cols = [
    { title: 'Date', w: 20, align: 'left' as const },
    { title: 'Libellé', w: 70, align: 'left' as const },
    { title: 'Catégorie', w: 36, align: 'left' as const },
    { title: 'Moyen', w: 26, align: 'left' as const },
    { title: 'Montant', w: W - 152, align: 'right' as const },
  ];
  const tableHead = () => {
    doc.setFillColor(C.brandSoft);
    doc.rect(M, y - 4.5, W, 7, 'F');
    font(8.5, 'bold', C.brandDeep);
    let x = M + 2;
    for (const c of cols) {
      doc.text(t(c.title), c.align === 'right' ? x + c.w - 4 : x, y, { align: c.align });
      x += c.w;
    }
    y += 6.5;
  };
  if (r.rows.length === 0) {
    font(9.5, 'normal', C.muted);
    doc.text(t('Aucune opération sur cette période.'), M, y);
    y += 8;
  } else {
    tableHead();
    r.rows.forEach((row, i) => {
      if (y + 6 > BOTTOM) {
        doc.addPage();
        y = header(false);
        tableHead();
      }
      if (i % 2 === 0) {
        doc.setFillColor(C.zebra);
        doc.rect(M, y - 4.3, W, 6.5, 'F');
      }
      font(8.5, 'normal', C.text);
      let x = M + 2;
      const cells = [formatShortDate(row.date), row.label, row.category, row.method];
      cells.forEach((v, ci) => {
        doc.text(fit(v, cols[ci].w - 3), x, y);
        x += cols[ci].w;
      });
      font(8.5, 'bold', row.type === 'revenu' ? C.pos : row.type === 'epargne' ? C.save : C.neg);
      doc.text(money(row.amount, true), x + cols[4].w - 4, y, { align: 'right' });
      y += 6.5;
    });
    ensure(10);
    doc.setDrawColor(C.line);
    doc.line(M, y - 3, PAGE_W - M, y - 3);
    font(9, 'bold');
    const net = r.rows.reduce((a, x) => a + x.amount, 0);
    doc.text(t('Solde des opérations de la période'), M + 2, y + 2);
    doc.setTextColor(net >= 0 ? C.pos : C.neg);
    doc.text(money(net, true), PAGE_W - M - 2, y + 2, { align: 'right' });
    y += 8;
  }

  /* ---------- Pied de page sur chaque page ---------- */
  const pages = doc.getNumberOfPages();
  for (let p = 1; p <= pages; p++) {
    doc.setPage(p);
    doc.setDrawColor(C.line);
    doc.setLineWidth(0.3);
    doc.line(M, PAGE_H - 12, PAGE_W - M, PAGE_H - 12);
    font(7.5, 'normal', C.muted);
    doc.text(t('Bankiétché · une appli Ghost.Technologies · Document généré sur ton téléphone, aucune donnée transmise.'), M, PAGE_H - 7.5);
    doc.text(t(`Page ${p} / ${pages}`), PAGE_W - M, PAGE_H - 7.5, { align: 'right' });
  }

  return doc.output('blob');
}
