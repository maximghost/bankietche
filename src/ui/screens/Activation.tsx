import { useState } from 'preact/hooks';
import { CHARIOW_URL } from '../../config';
import { PrivacyText, TermsText } from '../../legal/texts';
import {
  ACTIVATION_MESSAGES, activate, codeBody, formatCodeBody, type LicenceState,
} from '../../services/licence';
import { Page } from '../components';

export function ActivationScreen(props: { onActivated: (s: LicenceState) => void; reason?: 'revoked' | 'reactivate'; initialCode?: string }) {
  const [body, setBody] = useState(props.initialCode ? codeBody(props.initialCode) : '');
  const [error, setError] = useState<string | null>(
    props.reason === 'revoked' ? ACTIVATION_MESSAGES.revoked
      : props.reason === 'reactivate' ? 'Ton activation doit être confirmée. Appuie sur « Activer ».' : null);
  const [busy, setBusy] = useState(false);
  const [open, setOpen] = useState<'terms' | 'privacy' | null>(null);

  const submit = async (e: Event) => {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setError(null);
    const r = await activate(body);
    setBusy(false);
    if (r.ok) props.onActivated(r.state);
    else setError(ACTIVATION_MESSAGES[r.reason]);
  };

  return (
    <main class="welcome">
      <img src={`${import.meta.env.BASE_URL}icons/icon-192.png`} alt="" width={84} height={84} class="welcome-logo" />
      <h1>Bankiétché</h1>
      <p class="tagline">Ton banquier, dans ta poche.</p>

      <form class="card" onSubmit={submit} noValidate>
        <label for="code" class="field-label">Code d’activation</label>
        <div class="code-input">
          <span aria-hidden="true">BKT-</span>
          <input id="code" autoComplete="off" autoCapitalize="characters" spellcheck={false} aria-describedby="code-help"
            placeholder="XXXX-XXXX" value={formatCodeBody(body)} maxLength={20}
            onInput={(e) => setBody(codeBody(e.currentTarget.value))} />
        </div>
        <p class="field-hint" id="code-help">Tu l’as reçu par e-mail après ton achat sur Ghost.Store.</p>
        {error && <p class="form-error" role="alert">{error}</p>}
        <button class="btn btn-primary block" type="submit" disabled={busy || body.length < 8}>
          {busy ? 'Vérification…' : 'Activer'}
        </button>
        <p class="xsmall muted center">Une connexion Internet est nécessaire une seule fois.</p>
      </form>

      <div class="welcome-foot">
        {CHARIOW_URL && (
          <p class="center small">Pas encore de code ? <a href={CHARIOW_URL} target="_blank" rel="noopener">Obtenir Bankiétché</a></p>
        )}
        <p class="center xsmall">
          <button class="btn-link" onClick={() => setOpen('terms')}>Conditions d’utilisation</button>
          {' · '}
          <button class="btn-link" onClick={() => setOpen('privacy')}>Confidentialité</button>
        </p>
        <p class="center xsmall muted">Une appli Ghost.Technologies</p>
      </div>
      {open === 'terms' && <Page title="Conditions d’utilisation" onClose={() => setOpen(null)}><TermsText /></Page>}
      {open === 'privacy' && <Page title="Confidentialité" onClose={() => setOpen(null)}><PrivacyText /></Page>}
    </main>
  );
}
