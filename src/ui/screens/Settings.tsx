import {
  Bell, BellRing, CalendarRange, Download, Eye, FileText, Info, KeyRound, Landmark, LayoutGrid, MessageCircle,
  Palette, Scale, ShieldCheck, Smartphone, Trash2, Upload, UserRound, Wallet, Plus,
} from 'lucide-preact';
import { useRef, useState } from 'preact/hooks';
import { APP_VERSION } from '../../config';
import { buildBackup, BackupError, parseBackup, shareBackup, shareFile } from '../../data/backup';
import { recentPeriods } from '../../export/report';
import { formatShortDate } from '../../domain/dates';
import { formatInput, parseAmount } from '../../domain/money';
import { averageDays, convertBudget, periodKindLabel, periodPhrase, type PeriodConfig } from '../../domain/period';
import type { Category, Theme } from '../../domain/types';
import { isFilled, LEGAL_IDENTITY } from '../../legal/identity';
import { LegalNoticeText, PrivacyText, TermsText } from '../../legal/texts';
import { isIOS, isStandalone, useInstallPrompt } from '../../pwa';
import { disablePush, enablePush, permission, pushSupport, showExampleNotification } from '../../services/push';
import type { LicenceState } from '../../services/licence';
import { useStore } from '../../state/store';
import { closeLayer, Field, ListGroup, ListRow, Page, Segmented, Switch } from '../components';
import { useMoney } from '../format';
import { IconBadge } from '../icon-registry';
import { PeriodPicker } from '../PeriodPicker';
import { useUI } from '../ui-context';

type Sub =
  | 'notifications' | 'profile' | 'period' | 'budgets' | 'categories' | 'appearance' | 'backup' | 'install' | 'licence'
  | 'about' | 'terms' | 'privacy' | 'notice' | 'wipe';

export function SettingsPage(props: { licence: LicenceState; onClose: () => void }) {
  const { data, settings, updateSettings, lastBackupAt } = useStore();
  const fmt = useMoney();
  const [sub, setSub] = useState<Sub | null>(null);
  const close = () => setSub(null);
  const totalBudget = data.categories.filter((c) => c.kind === 'depense' && !c.archived).reduce((s, c) => s + c.budget, 0);
  const supportUrl = isFilled(LEGAL_IDENTITY.whatsapp)
    ? `https://wa.me/${LEGAL_IDENTITY.whatsapp.replace(/\D/g, '')}?text=${encodeURIComponent(`Bonjour, j’ai besoin d’aide avec Bankiétché (code ${props.licence.code.slice(0, 9)}…)`)}`
    : isFilled(LEGAL_IDENTITY.email) ? `mailto:${LEGAL_IDENTITY.email}?subject=${encodeURIComponent('Support Bankiétché')}` : null;
  const themeLabel = { system: 'Automatique', light: 'Clair', dark: 'Sombre' }[settings.theme];

  return (
    <Page title="Réglages" onClose={props.onClose}>
      <div class="list-card">
        <button class="profile-card" onClick={() => setSub('profile')} aria-label="Modifier mon prénom ou pseudo">
          <span class="avatar" aria-hidden="true">{(settings.name || '?').charAt(0).toUpperCase()}</span>
          <span class="grow">
            <b>{settings.name || 'Ajoute ton prénom'}</b><br />
            <span class="muted small">Prénom ou pseudo · personnalise tes messages</span>
          </span>
        </button>
      </div>

      <ListGroup title="Gestion">
        <ListRow icon={<CalendarRange size={18} />} label="Période de gestion" value={periodKindLabel(settings.period)} onClick={() => setSub('period')} />
        <ListRow icon={<Wallet size={18} />} label="Budgets" value={totalBudget > 0 ? fmt(totalBudget) : 'Non définis'} onClick={() => setSub('budgets')} />
        <ListRow icon={<LayoutGrid size={18} />} label="Catégories" value={String(data.categories.filter((c) => !c.archived && !c.system).length)} onClick={() => setSub('categories')} />
      </ListGroup>

      <ListGroup title="Rappels">
        <ListRow icon={<Bell size={18} />} label="Rappel quotidien"
          value={settings.notifications.enabled ? `à ${settings.notifications.hour} h` : 'Désactivé'} onClick={() => setSub('notifications')} />
      </ListGroup>

      <ListGroup title="Affichage">
        <ListRow icon={<Palette size={18} />} label="Apparence" value={themeLabel} onClick={() => setSub('appearance')} />
        <div>
          <Switch checked={settings.discreet} onChange={(v) => updateSettings({ discreet: v })}
            label="Mode discret" description="Masque les montants, utile en public." />
        </div>
      </ListGroup>

      <ListGroup title="Données" footer="Tes données restent uniquement sur ce téléphone.">
        <ListRow icon={<FileText size={18} />} label="Relevés et sauvegardes" value={lastBackupAt ? `sauvegardé le ${formatShortDate(lastBackupAt.slice(0, 10))}` : 'PDF, sauvegarde'} onClick={() => setSub('backup')} />
        <ListRow icon={<Trash2 size={18} />} label="Effacer toutes les données" danger onClick={() => setSub('wipe')} />
      </ListGroup>

      <ListGroup title="Application">
        {!isStandalone() && <ListRow icon={<Smartphone size={18} />} label="Installer sur l’écran d’accueil" onClick={() => setSub('install')} />}
        <ListRow icon={<KeyRound size={18} />} label="Licence" value={`${props.licence.code.slice(0, 9)}••••`} onClick={() => setSub('licence')} />
        <ListRow icon={<Info size={18} />} label="À propos" value={`v${APP_VERSION}`} onClick={() => setSub('about')} />
      </ListGroup>

      <ListGroup title="Aide et informations légales">
        {supportUrl && <ListRow icon={<MessageCircle size={18} />} label="Contacter le support" onClick={() => window.open(supportUrl, '_blank', 'noopener')} />}
        <ListRow icon={<FileText size={18} />} label="Conditions d’utilisation" onClick={() => setSub('terms')} />
        <ListRow icon={<ShieldCheck size={18} />} label="Politique de confidentialité" onClick={() => setSub('privacy')} />
        <ListRow icon={<Scale size={18} />} label="Mentions légales" onClick={() => setSub('notice')} />
      </ListGroup>

      <p class="about">Bankiétché v{APP_VERSION} · une appli Ghost.Technologies</p>

      {sub === 'notifications' && <NotificationsPage onClose={close} onInstall={() => setSub('install')} />}
      {sub === 'profile' && <ProfilePage onClose={close} />}
      {sub === 'period' && <PeriodPage onClose={close} />}
      {sub === 'budgets' && <BudgetsPage onClose={close} />}
      {sub === 'categories' && <CategoriesPage onClose={close} />}
      {sub === 'appearance' && <AppearancePage onClose={close} />}
      {sub === 'backup' && <BackupPage onClose={close} />}
      {sub === 'install' && <InstallPage onClose={close} />}
      {sub === 'licence' && <LicencePage licence={props.licence} onClose={close} />}
      {sub === 'about' && <AboutPage onClose={close} />}
      {sub === 'terms' && <Page title="Conditions d’utilisation" onClose={close}><TermsText /></Page>}
      {sub === 'privacy' && <Page title="Confidentialité" onClose={close}><PrivacyText /></Page>}
      {sub === 'notice' && <Page title="Mentions légales" onClose={close}><LegalNoticeText /></Page>}
      {sub === 'wipe' && <WipePage onClose={close} />}
    </Page>
  );
}

/* ------------------------------------------------------------------ */

const HOURS = Array.from({ length: 24 }, (_, h) => h);

export function NotificationsPage({ onClose, onInstall }: { onClose: () => void; onInstall: () => void }) {
  const { settings, updateSettings } = useStore();
  const n = settings.notifications;
  const support = pushSupport();
  const [perm, setPerm] = useState(permission());
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const ERR: Record<string, string> = {
    denied: 'Les notifications sont bloquées pour Bankiétché. Autorise-les dans les réglages de ton téléphone, puis réessaie.',
    network: 'Pas de connexion. Une connexion est nécessaire pour activer les rappels.',
    service: 'Le service de notification du téléphone n’a pas répondu. Réessaie dans quelques minutes.',
    licence: 'Ta licence n’a pas pu être vérifiée. Contacte le support.',
    invalid: 'L’activation a échoué. Réessaie dans un instant.',
    config: 'Les rappels ne sont pas encore disponibles sur cette version.',
    unsupported: 'Ton navigateur ne permet pas les notifications.',
  };

  const toggle = async (on: boolean) => {
    setBusy(true);
    setMsg(null);
    if (on) {
      const r = await enablePush(n.hour);
      setPerm(permission());
      if (r.ok) {
        await updateSettings({ notifications: { ...n, enabled: true } });
        setMsg({ ok: true, text: `C’est activé : tu recevras ton rappel chaque jour vers ${n.hour} h.` });
      } else setMsg({ ok: false, text: ERR[r.reason] });
    } else {
      await disablePush();
      await updateSettings({ notifications: { ...n, enabled: false } });
    }
    setBusy(false);
  };

  const changeHour = async (hour: number) => {
    await updateSettings({ notifications: { ...n, hour } });
    if (n.enabled) {
      const r = await enablePush(hour);
      setMsg(r.ok ? { ok: true, text: `Rappel déplacé à ${hour} h.` } : { ok: false, text: ERR[r.reason] });
    }
  };

  return (
    <Page title="Rappel quotidien" onClose={onClose}>
      <p class="muted">
        Bankiétché te fait signe une fois par jour : cotisation à venir ou en retard, budget dépassé, dépenses du jour
        à noter… Le message est rédigé <b>par ton téléphone</b> : le serveur ne connaît ni tes montants, ni tes catégories.
      </p>

      {support === 'ios-install' && (
        <div class="banner tone-info">
          <BellRing size={22} aria-hidden="true" />
          <span class="grow">Sur iPhone, les rappels nécessitent d’<b>installer Bankiétché sur l’écran d’accueil</b> (iOS 16.4 ou plus récent), puis de l’ouvrir depuis son icône.</span>
        </div>
      )}
      {support === 'ios-install' && <button class="btn btn-primary block" onClick={onInstall}>Comment l’installer</button>}
      {support === 'unsupported' && <p class="form-error">{ERR.unsupported}</p>}
      {support === 'config' && <p class="form-error">{ERR.config}</p>}
      {support === 'ok' && perm === 'denied' && <p class="form-error">{ERR.denied}</p>}

      {support === 'ok' && (
        <>
          <div class="list-card">
            <Switch checked={n.enabled} onChange={(v) => !busy && toggle(v)} label="Activer le rappel quotidien"
              description={busy ? 'Un instant…' : 'Une notification par jour, même écran verrouillé.'} />
            <label class="list-row">
              <span class="list-label">Heure du rappel</span>
              <select class="inline-select" value={String(n.hour)} onChange={(e) => changeHour(Number(e.currentTarget.value))} aria-label="Heure du rappel">
                {HOURS.map((h) => <option value={String(h)}>{`${h} h`}</option>)}
              </select>
            </label>
            <Switch checked={n.detailed} onChange={(v) => updateSettings({ notifications: { ...n, detailed: v } })}
              label="Messages détaillés" description="Affiche les noms et les montants. Attention : visibles sur l’écran verrouillé." />
          </div>
          {settings.discreet && n.detailed && <p class="muted small">Le mode discret est actif : les messages restent généraux.</p>}
          {n.enabled && perm === 'granted' && (
            <button class="btn btn-soft block" onClick={async () => {
              const ok = await showExampleNotification();
              setMsg(ok ? { ok: true, text: 'Voici le message que tu recevrais aujourd’hui.' } : { ok: false, text: ERR.denied });
            }}>Voir le message du jour</button>
          )}
        </>
      )}
      {msg && <p class={msg.ok ? 'info-box' : 'form-error'} role="status">{msg.text}</p>}
    </Page>
  );
}

function ProfilePage({ onClose }: { onClose: () => void }) {
  const { settings, updateSettings } = useStore();
  const [name, setName] = useState(settings.name);
  return (
    <Page title="Profil" onClose={onClose} footer={
      <button class="btn btn-primary block" onClick={async () => { await updateSettings({ name: name.trim() }); closeLayer(); }}>Enregistrer</button>
    }>
      <Field label="Prénom ou pseudo" hint="Il reste sur ton téléphone et sert seulement à personnaliser les messages.">
        <input type="text" maxLength={30} autoComplete="given-name" value={name} onInput={(e) => setName(e.currentTarget.value)} />
      </Field>
    </Page>
  );
}

function PeriodPage({ onClose }: { onClose: () => void }) {
  const { settings, updateSettings, data, saveCategories } = useStore();
  const ui = useUI();
  const [cfg, setCfg] = useState<PeriodConfig>(settings.period);
  const hasBudgets = data.categories.some((c) => c.budget > 0);
  const [convert, setConvert] = useState(true);
  const changed = JSON.stringify(cfg) !== JSON.stringify(settings.period);

  const save = async () => {
    if (hasBudgets && convert && averageDays(cfg) !== averageDays(settings.period)) {
      await saveCategories(data.categories.filter((c) => c.budget > 0).map((c) => ({ ...c, budget: convertBudget(c.budget, settings.period, cfg) })));
    }
    await updateSettings({ period: cfg });
    ui.backToCurrent();
    closeLayer();
  };

  return (
    <Page title="Période de gestion" onClose={onClose} footer={
      <button class="btn btn-primary block" disabled={!changed} onClick={save}>Appliquer</button>
    }>
      <p class="muted">Choisis le rythme qui correspond à ta façon de recevoir et de dépenser ton argent. Le solde, les budgets et les statistiques s’adaptent.</p>
      <PeriodPicker value={cfg} onChange={setCfg} today={ui.today} />
      {hasBudgets && changed && averageDays(cfg) !== averageDays(settings.period) && (
        <div class="list-card">
          <Switch checked={convert} onChange={setConvert} label="Adapter mes budgets"
            description="Convertit automatiquement tes budgets à la nouvelle durée (arrondis à 50 F)." />
        </div>
      )}
    </Page>
  );
}

function BudgetsPage({ onClose }: { onClose: () => void }) {
  const { data, settings, saveCategory } = useStore();
  const fmt = useMoney();
  const cats = data.categories.filter((c) => c.kind === 'depense' && !c.archived);
  const total = cats.reduce((s, c) => s + c.budget, 0);
  const save = async (c: Category, raw: string) => {
    const v = parseAmount(raw) ?? 0;
    if (v !== c.budget) await saveCategory({ ...c, budget: v });
  };
  return (
    <Page title="Budgets" onClose={onClose}>
      <p class="muted">Combien veux-tu dépenser au maximum <b>{periodPhrase(settings.period)}</b>, par catégorie ? Laisse vide pour ne pas fixer de limite.</p>
      <div class="list-card">
        {cats.map((c) => <BudgetInput key={c.id} category={c} onSave={save} />)}
      </div>
      <div class="card row between"><span>Total {periodPhrase(settings.period)}</span><b>{fmt(total)}</b></div>
    </Page>
  );
}

/** Champ de budget avec sa propre valeur : un enregistrement voisin ne l'écrase pas pendant la saisie. */
function BudgetInput({ category: c, onSave }: { category: Category; onSave: (c: Category, raw: string) => Promise<void> }) {
  const [text, setText] = useState(c.budget ? formatInput(String(c.budget)) : '');
  const [focused, setFocused] = useState(false);
  const shown = focused ? text : (c.budget ? formatInput(String(c.budget)) : '');
  return (
    <label class="budget-input">
      <IconBadge name={c.icon} size="sm" />
      <span class="grow">{c.name}</span>
      <span class="input-suffix small-input">
        <input inputMode="numeric" placeholder="—" aria-label={`Budget ${c.name}`} value={shown}
          onFocus={() => { setText(c.budget ? formatInput(String(c.budget)) : ''); setFocused(true); }}
          onInput={(e) => setText(formatInput(e.currentTarget.value))}
          onBlur={() => { setFocused(false); void onSave(c, text); }}
          onKeyDown={(e) => e.key === 'Enter' && e.currentTarget.blur()} />
        <span>F</span>
      </span>
    </label>
  );
}

function CategoriesPage({ onClose }: { onClose: () => void }) {
  const { data } = useStore();
  const ui = useUI();
  const [kind, setKind] = useState<'depense' | 'revenu'>('depense');
  const cats = data.categories.filter((c) => c.kind === kind && !c.system);
  return (
    <Page title="Catégories" onClose={onClose}>
      <Segmented<'depense' | 'revenu'> value={kind} onChange={setKind} label="Type" options={[
        { value: 'depense', label: 'Dépenses' }, { value: 'revenu', label: 'Entrées' },
      ]} />
      <div class="list-card">
        {cats.map((c) => (
          <button class="list-row" onClick={() => ui.open({ kind: 'category', category: c })}>
            <IconBadge name={c.icon} size="sm" />
            <span class="list-label" style={c.archived ? { opacity: 0.55 } : undefined}>{c.name}{c.archived ? ' (masquée)' : ''}</span>
          </button>
        ))}
      </div>
      <button class="btn btn-soft block" onClick={() => ui.open({ kind: 'category', catKind: kind })}><Plus size={20} aria-hidden="true" /> Nouvelle catégorie</button>
    </Page>
  );
}

function AppearancePage({ onClose }: { onClose: () => void }) {
  const { settings, updateSettings } = useStore();
  return (
    <Page title="Apparence" onClose={onClose}>
      <Segmented<Theme> value={settings.theme} onChange={(t) => updateSettings({ theme: t })} label="Thème" options={[
        { value: 'system', label: 'Automatique' }, { value: 'light', label: 'Clair' }, { value: 'dark', label: 'Sombre' },
      ]} />
      <p class="muted small">« Automatique » suit le réglage de ton téléphone. Le thème sombre économise la batterie sur les écrans OLED.</p>
    </Page>
  );
}

function BackupPage({ onClose }: { onClose: () => void }) {
  const { data, settings, lastBackupAt, markBackupDone, restore } = useStore();
  const ui = useUI();
  const fileRef = useRef<HTMLInputElement>(null);
  const periods = recentPeriods(settings, ui.today);
  const [periodIdx, setPeriodIdx] = useState(0);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const doPdf = async () => {
    setBusy(true);
    setMsg(null);
    try {
      // Chargé à la demande : le moteur PDF n'alourdit pas le démarrage de l'appli.
      const [{ buildReport, reportFileName }, { renderReportPdf }] = await Promise.all([
        import('../../export/report'), import('../../export/pdf'),
      ]);
      const report = buildReport(data, settings, periods[periodIdx].period, ui.today);
      const blob = await renderReportPdf(report);
      const r = await shareFile(blob, reportFileName(report), 'Relevé Bankiétché');
      if (r !== 'cancelled') setMsg({ ok: true, text: r === 'shared' ? 'Relevé PDF partagé.' : 'Relevé PDF téléchargé.' });
    } catch {
      setMsg({ ok: false, text: 'Le relevé n’a pas pu être créé. Réessaie.' });
    } finally {
      setBusy(false);
    }
  };
  const doBackup = async () => {
    const r = await shareBackup(buildBackup(data, settings));
    if (r !== 'cancelled') {
      await markBackupDone();
      setMsg({ ok: true, text: r === 'shared' ? 'Sauvegarde partagée.' : 'Sauvegarde téléchargée.' });
    }
  };
  const doImport = async (file: File | undefined) => {
    if (!file) return;
    try {
      const backup = parseBackup(await file.text());
      const n = backup.data.transactions.length;
      if (!confirm(`Restaurer cette sauvegarde (${n} opération${n > 1 ? 's' : ''}) ?\nTes données actuelles seront remplacées.`)) return;
      await restore(backup.data, backup.settings);
      setMsg({ ok: true, text: 'Données restaurées avec succès.' });
    } catch (e) {
      setMsg({ ok: false, text: e instanceof BackupError ? e.message : 'Impossible de lire ce fichier.' });
    } finally {
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  return (
    <Page title="Relevés et sauvegardes" onClose={onClose}>
      <ListGroup title="Relevé PDF" footer="Un document clair, à tes couleurs : indicateurs, budgets, objectifs, tontines et détail des opérations. Idéal pour garder une trace ou le montrer.">
        <label class="list-row">
          <span class="list-label">Période</span>
          <select class="inline-select" value={String(periodIdx)} onChange={(e) => setPeriodIdx(Number(e.currentTarget.value))} aria-label="Période du relevé">
            {periods.map((p, i) => <option value={String(i)}>{p.label}</option>)}
          </select>
        </label>
        <ListRow icon={<FileText size={18} />} label={busy ? 'Création du relevé…' : 'Créer le relevé PDF'} onClick={busy ? undefined : doPdf} />
      </ListGroup>

      <ListGroup title="Sauvegarde de restauration" footer="Fichier technique qui sert uniquement à retrouver tes données dans Bankiétché (nouveau téléphone, réinstallation). Garde-le en lieu sûr : Google Drive, e-mail ou WhatsApp à toi-même.">
        <div class="list-row"><span class="list-label">Dernière sauvegarde</span><span class="list-value">{lastBackupAt ? formatShortDate(lastBackupAt.slice(0, 10)) : 'jamais'}</span></div>
        <ListRow icon={<Download size={18} />} label="Créer une sauvegarde" onClick={doBackup} />
        <ListRow icon={<Upload size={18} />} label="Restaurer une sauvegarde" onClick={() => fileRef.current?.click()} />
      </ListGroup>
      <input ref={fileRef} type="file" accept="application/json,.json" hidden onChange={(e) => doImport(e.currentTarget.files?.[0])} />
      {msg && <p class={msg.ok ? 'info-box' : 'form-error'} role="status">{msg.text}</p>}
    </Page>
  );
}

function InstallPage({ onClose }: { onClose: () => void }) {
  const [available, install] = useInstallPrompt();
  return (
    <Page title="Installer l’appli" onClose={onClose}>
      <p class="muted">Ajoute Bankiétché à ton écran d’accueil : elle s’ouvrira comme une vraie appli, même sans connexion, sans occuper de place inutile.</p>
      {available ? (
        <button class="btn btn-primary block" onClick={install}>Installer sur mon téléphone</button>
      ) : isIOS() ? (
        <ol class="legal"><li>Ouvre Bankiétché dans <b>Safari</b>.</li><li>Appuie sur <b>Partager</b>.</li><li>Choisis <b>« Sur l’écran d’accueil »</b>.</li></ol>
      ) : (
        <ol class="legal"><li>Ouvre Bankiétché dans <b>Chrome</b>.</li><li>Ouvre le menu <b>⋮</b> en haut à droite.</li><li>Choisis <b>« Ajouter à l’écran d’accueil »</b> ou <b>« Installer l’application »</b>.</li></ol>
      )}
    </Page>
  );
}

function LicencePage({ licence, onClose }: { licence: LicenceState; onClose: () => void }) {
  return (
    <Page title="Licence" onClose={onClose}>
      <div class="list-card">
        <div class="list-row"><span class="list-label">Code</span><code>{licence.code.slice(0, 9)}••••</code></div>
        <div class="list-row"><span class="list-label">Activée le</span><span class="list-value">{formatShortDate(licence.activatedAt.slice(0, 10))}</span></div>
        <div class="list-row"><span class="list-label">Dernière vérification</span><span class="list-value">{formatShortDate(licence.lastVerifiedAt.slice(0, 10))}</span></div>
      </div>
      <p class="muted small">Ton code est valable sur 2 téléphones. En cas de changement d’appareil, contacte le support en indiquant ton code.</p>
    </Page>
  );
}

function AboutPage({ onClose }: { onClose: () => void }) {
  return (
    <Page title="À propos" onClose={onClose}>
      <div class="card center" style={{ justifyItems: 'center', textAlign: 'center' }}>
        <img src={`${import.meta.env.BASE_URL}icons/icon-192.png`} alt="" width={72} height={72} style={{ borderRadius: 18 }} />
        <p style={{ fontSize: 22, fontWeight: 800 }}>Bankiétché</p>
        <p class="muted">« Mon banquier » en fon</p>
        <p>Version {APP_VERSION}</p>
      </div>
      <div class="list-card">
        <div class="list-row"><Landmark size={18} aria-hidden="true" /><span class="list-label">Éditeur</span><span class="list-value">{LEGAL_IDENTITY.editor}</span></div>
        <div class="list-row"><Eye size={18} aria-hidden="true" /><span class="list-label">Données</span><span class="list-value">Sur ton téléphone</span></div>
        <div class="list-row"><UserRound size={18} aria-hidden="true" /><span class="list-label">Compte</span><span class="list-value">Aucun requis</span></div>
      </div>
      <p class="muted small center">Disponible sur {LEGAL_IDENTITY.store}.</p>
    </Page>
  );
}

function WipePage({ onClose }: { onClose: () => void }) {
  const { wipe } = useStore();
  const [text, setText] = useState('');
  const ok = text.trim().toUpperCase() === 'EFFACER';
  return (
    <Page title="Effacer les données" onClose={onClose} footer={
      <button class="btn btn-danger block" disabled={!ok} onClick={async () => { await wipe(); closeLayer(); }}>Tout effacer définitivement</button>
    }>
      <p class="form-error">Cette action supprime toutes tes opérations, budgets, tontines, objectifs et réglages de ce téléphone. Elle est irréversible.</p>
      <p class="muted">Pense à créer une sauvegarde avant. Ta licence reste active.</p>
      <Field label="Pour confirmer, écris EFFACER">
        <input type="text" autoCapitalize="characters" value={text} onInput={(e) => setText(e.currentTarget.value)} />
      </Field>
    </Page>
  );
}
