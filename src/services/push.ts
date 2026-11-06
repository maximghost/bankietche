/** Rappels quotidiens : côté appli (fenêtre). */
import { SUPABASE_URL, VAPID_PUBLIC_KEY } from '../config';
import { getMeta, loadAll, loadSettings } from '../data/db';
import { today } from '../domain/dates';
import { buildDailyNotification } from '../domain/notify';
import { isIOS, isStandalone } from '../pwa';
import { registerOnServer, subscribeOptions, unregisterOnServer, type PushResult } from './push-core';

export type PushSupport = 'ok' | 'ios-install' | 'unsupported' | 'config';

export function pushSupport(): PushSupport {
  if (!SUPABASE_URL || !VAPID_PUBLIC_KEY) return 'config';
  const hasApis = 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
  // Sur iPhone/iPad, les notifications n'existent que pour l'appli installée sur l'écran d'accueil.
  if (isIOS() && !isStandalone()) return 'ios-install';
  return hasApis ? 'ok' : 'unsupported';
}

export function permission(): NotificationPermission | 'unsupported' {
  return 'Notification' in window ? Notification.permission : 'unsupported';
}

export type EnableResult = PushResult | { ok: false; reason: 'denied' | 'unsupported' | 'service' };

/** À appeler depuis un geste de l'utilisateur (exigence d'iOS). */
export async function enablePush(hour: number): Promise<EnableResult> {
  if (pushSupport() !== 'ok') return { ok: false, reason: 'unsupported' };
  const perm = await Notification.requestPermission();
  if (perm !== 'granted') return { ok: false, reason: 'denied' };
  try {
    const reg = await navigator.serviceWorker.ready;
    const sub = (await reg.pushManager.getSubscription()) ?? (await reg.pushManager.subscribe(subscribeOptions()));
    return await registerOnServer(sub, hour);
  } catch {
    // En ligne mais refus du service de notification du téléphone (Apple / Google).
    return { ok: false, reason: navigator.onLine ? 'service' : 'network' };
  }
}

export async function disablePush(): Promise<void> {
  try {
    const reg = await navigator.serviceWorker.ready;
    const sub = await reg.pushManager.getSubscription();
    if (sub) {
      await unregisterOnServer(sub.endpoint);
      await sub.unsubscribe();
    }
  } catch { /* rien à faire */ }
}

/**
 * Au démarrage : si les rappels sont activés, on s'assure que l'abonnement
 * existe toujours (le navigateur peut le renouveler) et que le serveur
 * connaît le bon fuseau horaire. Silencieux en cas d'échec.
 */
export async function resyncPush(enabled: boolean, hour: number): Promise<void> {
  if (!enabled || pushSupport() !== 'ok' || permission() !== 'granted' || !navigator.onLine) return;
  try {
    const reg = await navigator.serviceWorker.ready;
    const sub = (await reg.pushManager.getSubscription()) ?? (await reg.pushManager.subscribe(subscribeOptions()));
    await registerOnServer(sub, hour);
  } catch { /* nouvel essai au prochain démarrage */ }
}

/** Affiche tout de suite la notification du jour, pour que l'utilisateur voie le rendu. */
export async function showExampleNotification(): Promise<boolean> {
  if (permission() !== 'granted') return false;
  const [data, settings, lastBackupAt] = await Promise.all([loadAll(), loadSettings(), getMeta<string>('lastBackupAt')]);
  const n = buildDailyNotification({ data, settings, todayISO: today(), lastBackupAt: lastBackupAt ?? null });
  const reg = await navigator.serviceWorker.ready;
  await reg.showNotification(n.title, {
    body: n.body, tag: n.tag, icon: `${import.meta.env.BASE_URL}icons/icon-192.png`,
    badge: `${import.meta.env.BASE_URL}icons/badge-96.png`, data: { url: import.meta.env.BASE_URL },
  });
  return true;
}
