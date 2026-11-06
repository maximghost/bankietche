import { APP_VERSION, LICENCE_RECHECK_DAYS, SUPABASE_ANON_KEY, SUPABASE_URL } from '../config';
import { getMeta, setMeta } from '../data/db';

/**
 * Licences Bankiétché.
 *  - Activation : une seule fois, connexion requise. Le code est lié à l'appareil
 *    (2 appareils max par code, réglable dans Supabase).
 *  - Ensuite l'appli fonctionne hors connexion. Quand elle est en ligne, elle
 *    revérifie le code tous les LICENCE_RECHECK_DAYS jours (pour la révocation).
 *  - Hors connexion, l'appli n'est JAMAIS bloquée.
 */

export interface LicenceState {
  code: string;
  activatedAt: string;
  lastVerifiedAt: string;
  status: 'active' | 'revoked' | 'reactivate';
}

export type ActivationResult =
  | { ok: true; state: LicenceState }
  | { ok: false; reason: 'invalid' | 'revoked' | 'limit' | 'rate_limited' | 'network' | 'config' | 'format' };

const LICENCE_KEY = 'licence';
const DEVICE_KEY = 'deviceId';
const CODE_RE = /^BKT-[A-HJKMNP-Z2-9]{4}-[A-HJKMNP-Z2-9]{4}$/;
const DEMO_CODE = 'BKT-DEMO-DEMO';

export const ACTIVATION_MESSAGES: Record<Exclude<ActivationResult, { ok: true }>['reason'], string> = {
  format: 'Le code doit ressembler à BKT-XXXX-XXXX. Vérifie ton e-mail d’achat.',
  invalid: 'Ce code n’existe pas. Vérifie chaque caractère (pas de 0 ni de O, pas de 1 ni de I).',
  revoked: 'Ce code a été désactivé. Contacte le support Ghost.Store.',
  limit: 'Ce code est déjà utilisé sur le nombre maximum de téléphones.',
  rate_limited: 'Trop d’essais. Patiente une heure puis réessaie.',
  network: 'Pas de connexion. Active tes données ou le Wi-Fi pour la première activation.',
  config: 'Appli mal configurée (serveur de licences absent). Contacte le support.',
};

/**
 * Partie variable du code (8 caractères max), à partir d'une saisie ou d'un collage.
 * "bkt-7k2m-qx9p" -> "7K2MQX9P" ; "7k2m qx" -> "7K2MQX".
 * Le préfixe BKT n'est retiré que si la saisie dépasse 8 caractères,
 * car la partie variable peut elle-même commencer par B, K, T.
 */
export function codeBody(input: string): string {
  const c = input.toUpperCase().replace(/[^A-Z0-9]/g, '');
  return (c.length > 8 && c.startsWith('BKT') ? c.slice(3) : c).slice(0, 8);
}

/** Affichage de la partie variable pendant la saisie : "7K2MQX" -> "7K2M-QX". */
export function formatCodeBody(body: string): string {
  return body.length > 4 ? `${body.slice(0, 4)}-${body.slice(4)}` : body;
}

/** Normalise une saisie complète : "bkt 7k2m qx9p" -> "BKT-7K2M-QX9P". */
export function normalizeCode(input: string): string {
  return `BKT-${formatCodeBody(codeBody(input))}`;
}

export function isWellFormed(code: string): boolean {
  return CODE_RE.test(code) || (import.meta.env.DEV && code === DEMO_CODE);
}

export async function getDeviceId(): Promise<string> {
  let id = await getMeta<string>(DEVICE_KEY);
  if (!id) {
    id = crypto.randomUUID();
    await setMeta(DEVICE_KEY, id);
  }
  return id;
}

export function getLicence(): Promise<LicenceState | undefined> {
  return getMeta<LicenceState>(LICENCE_KEY);
}

async function rpc(fn: 'activate_licence' | 'verify_licence', code: string): Promise<{ status: string }> {
  // Clé "publishable" (sb_publishable_…) : uniquement dans l'en-tête apikey.
  // Ancienne clé "anon" (JWT eyJ…) : également en Authorization Bearer.
  const headers: Record<string, string> = { 'Content-Type': 'application/json', apikey: SUPABASE_ANON_KEY };
  if (SUPABASE_ANON_KEY.startsWith('eyJ')) headers.Authorization = `Bearer ${SUPABASE_ANON_KEY}`;
  const res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/${fn}`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ p_code: code, p_device_id: await getDeviceId(), p_app_version: APP_VERSION }),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

export async function activate(input: string): Promise<ActivationResult> {
  const code = normalizeCode(input);
  if (!isWellFormed(code)) return { ok: false, reason: 'format' };

  const now = new Date().toISOString();

  // Code de démonstration : uniquement en développement local (`npm run dev`).
  if (import.meta.env.DEV && code === DEMO_CODE) {
    const state: LicenceState = { code, activatedAt: now, lastVerifiedAt: now, status: 'active' };
    await setMeta(LICENCE_KEY, state);
    return { ok: true, state };
  }

  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) return { ok: false, reason: 'config' };

  let status: string;
  try {
    status = (await rpc('activate_licence', code)).status;
  } catch {
    return { ok: false, reason: 'network' };
  }

  if (status === 'ok') {
    const state: LicenceState = { code, activatedAt: now, lastVerifiedAt: now, status: 'active' };
    await setMeta(LICENCE_KEY, state);
    return { ok: true, state };
  }
  if (status === 'invalid' || status === 'revoked' || status === 'limit' || status === 'rate_limited') {
    return { ok: false, reason: status };
  }
  return { ok: false, reason: 'network' };
}

/**
 * Revérifie la licence si la dernière vérification date de plus de N jours.
 * Silencieux en cas d'erreur réseau : on ne bloque jamais hors connexion.
 */
export async function recheckIfDue(state: LicenceState, now: Date = new Date()): Promise<LicenceState> {
  if (import.meta.env.DEV && state.code === DEMO_CODE) return state;
  if (!SUPABASE_URL || !navigator.onLine) return state;

  const elapsedDays = (now.getTime() - new Date(state.lastVerifiedAt).getTime()) / 86_400_000;
  if (elapsedDays < LICENCE_RECHECK_DAYS) return state;

  try {
    const { status } = await rpc('verify_licence', state.code);
    const next: LicenceState = {
      ...state,
      lastVerifiedAt: now.toISOString(),
      status: status === 'ok' ? 'active' : status === 'revoked' ? 'revoked' : 'reactivate',
    };
    await setMeta(LICENCE_KEY, next);
    return next;
  } catch {
    return state;
  }
}
