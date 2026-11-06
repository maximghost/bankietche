import { ChartColumn, Eye, EyeOff, House, List, PiggyBank, Plus, RefreshCw, Settings as Gear } from 'lucide-preact';
import type { JSX } from 'preact';
import { useEffect, useMemo, useState } from 'preact/hooks';
import { formatLongDate, today } from './domain/dates';
import { greeting } from './domain/coach';
import { formatPeriod, periodAt, shiftPeriod } from './domain/period';
import type { Theme } from './domain/types';
import { LEGAL_VERSION } from './legal/identity';
import { useUpdateAvailable } from './pwa';
import { getLicence, recheckIfDue, type LicenceState } from './services/licence';
import { resyncPush } from './services/push';
import { StoreProvider, useStore } from './state/store';
import { CategorySheet, GoalSheet, TontineSheet } from './ui/forms/EntityForms';
import { TransactionSheet } from './ui/forms/TransactionForm';
import { ActivationScreen } from './ui/screens/Activation';
import { HistoryScreen } from './ui/screens/History';
import { HomeScreen } from './ui/screens/Home';
import { SavingsScreen } from './ui/screens/Savings';
import { NotificationsPage, SettingsPage } from './ui/screens/Settings';
import { StatsScreen } from './ui/screens/Stats';
import { Onboarding, TermsGate } from './ui/screens/Welcome';
import { UICtx, type SheetState, type Tab, type UI } from './ui/ui-context';

export function App() {
  const [licence, setLicence] = useState<LicenceState | null | undefined>(undefined);

  useEffect(() => {
    void (async () => {
      const l = await getLicence();
      setLicence(l ?? null);
      if (l) setLicence(await recheckIfDue(l));
    })();
  }, []);

  if (licence === undefined) return <div class="splash" />;
  if (!licence || licence.status !== 'active') {
    return (
      <ActivationScreen onActivated={setLicence}
        reason={licence?.status === 'revoked' ? 'revoked' : licence?.status === 'reactivate' ? 'reactivate' : undefined}
        initialCode={licence?.code} />
    );
  }
  return (
    <StoreProvider>
      <ThemeSync />
      <Gate licence={licence} />
    </StoreProvider>
  );
}

/** Applique le thème choisi (clair, sombre, ou celui du téléphone). */
function ThemeSync() {
  const { settings } = useStore();
  useEffect(() => applyTheme(settings.theme), [settings.theme]);
  return null;
}

function applyTheme(theme: Theme) {
  const mq = window.matchMedia('(prefers-color-scheme: dark)');
  const set = () => {
    const dark = theme === 'dark' || (theme === 'system' && mq.matches);
    document.documentElement.dataset.theme = dark ? 'dark' : 'light';
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', dark ? '#0F0D18' : '#6D28D9');
  };
  set();
  if (theme !== 'system') return;
  mq.addEventListener('change', set);
  return () => mq.removeEventListener('change', set);
}

function Gate({ licence }: { licence: LicenceState }) {
  const { ready, settings } = useStore();
  if (!ready) return <div class="splash" />;
  if (settings.termsVersion !== LEGAL_VERSION) return <TermsGate />;
  if (!settings.onboarded) return <Onboarding />;
  return <Shell licence={licence} />;
}

const TAB_TITLES: Record<Tab, string> = { home: '', history: 'Opérations', savings: 'Épargne', stats: 'Statistiques' };

function Shell({ licence }: { licence: LicenceState }) {
  const { settings, updateSettings } = useStore();
  const [tab, setTabState] = useState<Tab>('home');
  const [sheet, setSheet] = useState<SheetState | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);
  const [todayISO, setToday] = useState(today());
  const [anchor, setAnchor] = useState(todayISO);
  const [updateReady, applyUpdate] = useUpdateAvailable();
  const cfg = settings.period;

  // Rappels : on revérifie l'abonnement une fois par ouverture de l'appli.
  useEffect(() => { void resyncPush(settings.notifications.enabled, settings.notifications.hour); }, []);

  // Passage à minuit / retour au premier plan : on rafraîchit la date du jour.
  useEffect(() => {
    const refresh = () => {
      const t = today();
      setToday((prev) => {
        if (prev !== t) setAnchor((a) => (periodAt(cfg, a).start === periodAt(cfg, prev).start ? t : a));
        return t;
      });
    };
    document.addEventListener('visibilitychange', refresh);
    const id = window.setInterval(refresh, 60_000);
    return () => { document.removeEventListener('visibilitychange', refresh); clearInterval(id); };
  }, [cfg]);

  const ui = useMemo<UI>(() => {
    const period = periodAt(cfg, anchor);
    const current = periodAt(cfg, todayISO);
    const isCurrent = period.start === current.start;
    const canNext = period.end < todayISO;
    const label = isCurrent
      ? ({ jour: 'Aujourd’hui', semaine: 'Cette semaine', mois: 'Ce mois-ci', annee: 'Cette année', libre: 'Période en cours' } as const)[cfg.kind]
      : formatPeriod(cfg, period, todayISO);
    const sub = isCurrent ? (cfg.kind === 'jour' ? formatLongDate(todayISO) : formatPeriod(cfg, period, todayISO)) : '';
    return {
      tab,
      setTab: (t: Tab) => { setTabState(t); window.scrollTo(0, 0); },
      open: setSheet,
      openSettings: () => setSettingsOpen(true),
      openNotifications: () => setNotifOpen(true),
      period,
      isCurrent,
      canNext,
      shift: (d: number) => setAnchor((a) => {
        const next = shiftPeriod(cfg, periodAt(cfg, a), d);
        return next.start > todayISO ? a : next.start;
      }),
      backToCurrent: () => setAnchor(todayISO),
      periodLabel: label,
      periodSub: sub,
      today: todayISO,
    };
  }, [tab, cfg, anchor, todayISO]);

  const hour = new Date().getHours();
  const title = tab === 'home' ? greeting(settings.name, hour) : TAB_TITLES[tab];
  const DiscreetIcon = settings.discreet ? EyeOff : Eye;

  return (
    <UICtx.Provider value={ui}>
      <header class="topbar">
        <div class="topbar-title">
          <h1>{title}</h1>
          {tab === 'home' && <p class="topbar-sub">{formatLongDate(todayISO)}</p>}
        </div>
        <button class="icon-btn" onClick={() => updateSettings({ discreet: !settings.discreet })}
          aria-label={settings.discreet ? 'Afficher les montants' : 'Masquer les montants'} aria-pressed={settings.discreet}>
          <DiscreetIcon size={22} aria-hidden="true" />
        </button>
        <button class="icon-btn" onClick={() => setSettingsOpen(true)} aria-label="Réglages"><Gear size={22} aria-hidden="true" /></button>
      </header>

      {updateReady && (
        <button class="update-banner" onClick={applyUpdate}><RefreshCw size={18} aria-hidden="true" /> Nouvelle version disponible · Mettre à jour</button>
      )}

      <main>
        {tab === 'home' && <HomeScreen />}
        {tab === 'history' && <HistoryScreen />}
        {tab === 'savings' && <SavingsScreen />}
        {tab === 'stats' && <StatsScreen />}
      </main>

      <nav class="tabbar" aria-label="Navigation principale">
        <TabButton tab="home" current={tab} onClick={ui.setTab} label="Accueil" icon={<House size={22} aria-hidden="true" />} />
        <TabButton tab="history" current={tab} onClick={ui.setTab} label="Opérations" icon={<List size={22} aria-hidden="true" />} />
        <button class="fab" onClick={() => setSheet({ kind: 'tx' })} aria-label="Ajouter une opération"><Plus size={28} aria-hidden="true" /></button>
        <TabButton tab="savings" current={tab} onClick={ui.setTab} label="Épargne" icon={<PiggyBank size={22} aria-hidden="true" />} />
        <TabButton tab="stats" current={tab} onClick={ui.setTab} label="Stats" icon={<ChartColumn size={22} aria-hidden="true" />} />
      </nav>

      {settingsOpen && <SettingsPage licence={licence} onClose={() => setSettingsOpen(false)} />}
      {notifOpen && <NotificationsPage onClose={() => setNotifOpen(false)} onInstall={() => setNotifOpen(false)} />}
      {sheet?.kind === 'tx' && <TransactionSheet initial={sheet.draft} onClose={() => setSheet(null)} />}
      {sheet?.kind === 'goal' && <GoalSheet goal={sheet.goal} onClose={() => setSheet(null)} />}
      {sheet?.kind === 'tontine' && <TontineSheet tontine={sheet.tontine} onClose={() => setSheet(null)} />}
      {sheet?.kind === 'category' && <CategorySheet category={sheet.category} kind={sheet.catKind} onClose={() => setSheet(null)} />}
    </UICtx.Provider>
  );
}

function TabButton(props: { tab: Tab; current: Tab; onClick: (t: Tab) => void; label: string; icon: JSX.Element }) {
  const active = props.tab === props.current;
  return (
    <button class={`tab ${active ? 'active' : ''}`} aria-current={active ? 'page' : undefined} onClick={() => props.onClick(props.tab)}>
      {props.icon}
      <span>{props.label}</span>
    </button>
  );
}
