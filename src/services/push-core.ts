/**
 * Abonnement aux rappels : code partagé entre l'appli et le service worker
 * (aucune API propre à la fenêtre ici).
 */
import { SUPABASE_ANON_KEY, SUPABASE_URL, VAPID_PUBLIC_KEY } from '../config';
import { getMeta } from '../data/db';

export type PushResult = { ok: true } | { ok: false; reason: 'network' | 'licence' | 'invalid' | 'config' };

export function urlBase64ToUint8Array(b64: string): Uint8Array<ArrayBuffer> {
  const pad = '='.repeat((4 - (b64.length % 4)) % 4);
  const raw = atob((b64 + pad).replace(/-/g, '+').replace(/_/g, '/'));
  const out = new Uint8Array(new ArrayBuffer(raw.length));
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}

export function subscribeOptions(): PushSubscriptionOptionsInit {
  return { userVisibleOnly: true, applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY) };
}

async function rpc(fn: string, body: unknown): Promise<{ status: string }> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json', apikey: SUPABASE_ANON_KEY };
  if (SUPABASE_ANON_KEY.startsWith('eyJ')) headers.Authorization = `Bearer ${SUPABASE_ANON_KEY}`;
  const res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/${fn}`, { method: 'POST', headers, body: JSON.stringify(body) });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

/** Enregistre (ou met à jour) l'abonnement côté serveur. */
export async function registerOnServer(sub: PushSubscription, hour: number): Promise<PushResult> {
  if (!SUPABASE_URL || !VAPID_PUBLIC_KEY) return { ok: false, reason: 'config' };
  const licence = await getMeta<{ code: string }>('licence');
  const deviceId = await getMeta<string>('deviceId');
  const json = sub.toJSON();
  if (!licence || !deviceId || !json.endpoint || !json.keys?.p256dh || !json.keys?.auth) return { ok: false, reason: 'invalid' };
  try {
    const { status } = await rpc('push_subscribe', {
      p_code: licence.code,
      p_device_id: deviceId,
      p_endpoint: json.endpoint,
      p_p256dh: json.keys.p256dh,
      p_auth: json.keys.auth,
      p_hour: hour,
      p_tz: Intl.DateTimeFormat().resolvedOptions().timeZone || 'Africa/Porto-Novo',
    });
    if (status === 'ok') return { ok: true };
    return { ok: false, reason: status === 'licence' ? 'licence' : 'invalid' };
  } catch {
    return { ok: false, reason: 'network' };
  }
}

export async function unregisterOnServer(endpoint: string): Promise<void> {
  const deviceId = await getMeta<string>('deviceId');
  if (!deviceId || !SUPABASE_URL) return;
  try {
    await rpc('push_unsubscribe', { p_device_id: deviceId, p_endpoint: endpoint });
  } catch { /* hors connexion : l'adresse expirera d'elle-même côté serveur */ }
}
