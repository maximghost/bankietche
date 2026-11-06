import { useState } from 'preact/hooks';
import { CAT_SOLDE_DEPART } from '../../domain/defaults';
import { today } from '../../domain/dates';
import { formatInput, parseAmount } from '../../domain/money';
import type { PeriodConfig } from '../../domain/period';
import { LEGAL_VERSION } from '../../legal/identity';
import { PrivacyText, TermsText } from '../../legal/texts';
import type { PaymentMethod } from '../../domain/types';
import { PAYMENT_METHODS } from '../../domain/types';
import { useStore } from '../../state/store';
import { Field, Page } from '../components';
import { PeriodPicker } from '../PeriodPicker';

const Logo = () => (
  <img src={`${import.meta.env.BASE_URL}icons/icon-192.png`} alt="" width={76} height={76} class="welcome-logo" />
);

/** Acceptation des CGU (première fois, ou après une mise à jour des textes). */
export function TermsGate() {
  const { settings, updateSettings } = useStore();
  const [checked, setChecked] = useState(false);
  const [open, setOpen] = useState<'terms' | 'privacy' | null>(null);
  const isUpdate = Boolean(settings.termsVersion);
  return (
    <main class="welcome">
      <Logo />
      <h1>{isUpdate ? 'Nos conditions évoluent' : 'Avant de commencer'}</h1>
      <p class="tagline">
        {isUpdate ? 'Merci de prendre connaissance des nouvelles conditions.' : 'Bankiétché respecte ta vie privée : tes données restent sur ton téléphone.'}
      </p>
      <div class="list-card">
        <button class="list-row" onClick={() => setOpen('terms')}><span class="list-label">Lire les conditions d’utilisation</span></button>
        <button class="list-row" onClick={() => setOpen('privacy')}><span class="list-label">Lire la politique de confidentialité</span></button>
      </div>
      <div class="welcome-foot">
        <label class="checkbox">
          <input type="checkbox" checked={checked} onChange={(e) => setChecked(e.currentTarget.checked)} />
          <span>J’ai lu et j’accepte les conditions d’utilisation et la politique de confidentialité.</span>
        </label>
        <button class="btn btn-primary block" disabled={!checked}
          onClick={() => updateSettings({ termsVersion: LEGAL_VERSION, termsAcceptedAt: new Date().toISOString() })}>
          Continuer
        </button>
      </div>
      {open === 'terms' && <Page title="Conditions d’utilisation" onClose={() => setOpen(null)}><TermsText /></Page>}
      {open === 'privacy' && <Page title="Confidentialité" onClose={() => setOpen(null)}><PrivacyText /></Page>}
    </main>
  );
}

/** Assistant de premier lancement : prénom, période de gestion, argent disponible. */
export function Onboarding() {
  const { settings, updateSettings, saveTransaction } = useStore();
  const [step, setStep] = useState(0);
  const [name, setName] = useState(settings.name);
  const [period, setPeriod] = useState<PeriodConfig>(settings.period);
  const [amount, setAmount] = useState('');
  const [method, setMethod] = useState<PaymentMethod>('mtn');
  const todayISO = today();
  const first = name.trim();

  const finish = async (withBalance: boolean) => {
    const v = parseAmount(amount);
    if (withBalance && v) {
      await saveTransaction({ type: 'revenu', amount: v, categoryId: CAT_SOLDE_DEPART, method, date: todayISO, note: 'Solde de départ' });
    }
    await updateSettings({ name: first, period, onboarded: true });
  };

  return (
    <main class="welcome">
      <div class="steps" role="progressbar" aria-valuemin={1} aria-valuemax={3} aria-valuenow={step + 1} aria-label={`Étape ${step + 1} sur 3`}>
        {[0, 1, 2].map((i) => <span class={i <= step ? 'on' : ''} />)}
      </div>

      {step === 0 && (
        <>
          <Logo />
          <h1>Bienvenue sur Bankiétché</h1>
          <p class="tagline">Ton banquier, dans ta poche. Comment veux-tu qu’on t’appelle ?</p>
          <Field label="Prénom ou pseudo" hint="Il reste sur ton téléphone.">
            <input type="text" maxLength={30} autoComplete="given-name" placeholder="ex. Maxim" value={name}
              onInput={(e) => setName(e.currentTarget.value)} onKeyDown={(e) => e.key === 'Enter' && setStep(1)} />
          </Field>
          <div class="welcome-foot">
            <button class="btn btn-primary block" onClick={() => setStep(1)}>{first ? `Enchanté, ${first} !` : 'Continuer'}</button>
          </div>
        </>
      )}

      {step === 1 && (
        <>
          <h1>{first ? `${first}, à quel rythme gères-tu ton argent ?` : 'À quel rythme gères-tu ton argent ?'}</h1>
          <p class="tagline">Tu pourras changer ce choix à tout moment dans les réglages.</p>
          <PeriodPicker value={period} onChange={setPeriod} today={todayISO} />
          <div class="welcome-foot">
            <button class="btn btn-primary block" onClick={() => setStep(2)}>Continuer</button>
            <button class="btn-link" onClick={() => setStep(0)}>Retour</button>
          </div>
        </>
      )}

      {step === 2 && (
        <>
          <h1>Combien as-tu en ce moment ?</h1>
          <p class="tagline">Additionne ton argent en espèces et sur Mobile Money. C’est ton point de départ.</p>
          <div class="amount-input type-revenu">
            <input inputMode="numeric" placeholder="0" aria-label="Montant disponible en francs CFA" value={amount}
              onInput={(e) => setAmount(formatInput(e.currentTarget.value))} />
            <span>F</span>
          </div>
          <div class="chips center" role="group" aria-label="Où se trouve surtout cet argent ?">
            {PAYMENT_METHODS.filter((m) => m.id !== 'autre').map((m) => (
              <button class="chip" aria-pressed={method === m.id} onClick={() => setMethod(m.id)}>
                <span class="dot" style={{ background: m.color }} />{m.label}
              </button>
            ))}
          </div>
          <div class="welcome-foot">
            <button class="btn btn-primary block" disabled={!parseAmount(amount)} onClick={() => finish(true)}>C’est parti !</button>
            <button class="btn-link" onClick={() => finish(false)}>Passer cette étape</button>
          </div>
        </>
      )}
    </main>
  );
}
