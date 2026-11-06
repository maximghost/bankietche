/// <reference lib="webworker" />
/**
 * Service worker de Bankiétché :
 *  - met l'appli en cache pour qu'elle marche hors connexion (Workbox) ;
 *  - reçoit le « réveil » quotidien du serveur et rédige la notification
 *    à partir des données LOCALES (le serveur n'envoie aucune donnée).
 */
import { cleanupOutdatedCaches, createHandlerBoundToURL, precacheAndRoute } from 'workbox-precaching';
import { NavigationRoute, registerRoute } from 'workbox-routing';
import { getMeta, loadAll, loadSettings } from './data/db';
import { today } from './domain/dates';
import { buildDailyNotification } from './domain/notify';
import { registerOnServer, subscribeOptions } from './services/push-core';

declare const self: ServiceWorkerGlobalScope;

cleanupOutdatedCaches();
precacheAndRoute(self.__WB_MANIFEST);
registerRoute(new NavigationRoute(createHandlerBoundToURL('index.html')));

// Mise à jour à la demande de l'utilisateur (bandeau « Mettre à jour »).
self.addEventListener('message', (event) => {
  if (event.data?.type === 'SKIP_WAITING') void self.skipWaiting();
});

const ICON = 'icons/icon-192.png';
const BADGE = 'icons/badge-96.png';

async function showDaily() {
  // Une notification DOIT être affichée à chaque réception (règle d'iOS) :
  // en cas d'erreur, on affiche un rappel générique.
  let title = 'Bankiétché';
  let body = 'As-tu noté tes dépenses d’aujourd’hui ?';
  let tag = 'bankietche-quotidien';
  try {
    const [data, settings, lastBackupAt] = await Promise.all([loadAll(), loadSettings(), getMeta<string>('lastBackupAt')]);
    if (!settings.notifications.enabled) {
      // Rappels désactivés entre-temps : on se désabonne proprement.
      const sub = await self.registration.pushManager.getSubscription();
      await sub?.unsubscribe();
    }
    const n = buildDailyNotification({ data, settings, todayISO: today(), lastBackupAt: lastBackupAt ?? null });
    ({ title, body, tag } = n);
  } catch { /* message générique */ }
  await self.registration.showNotification(title, {
    body, tag, icon: ICON, badge: BADGE, data: { url: self.registration.scope },
  });
}

self.addEventListener('push', (event) => {
  event.waitUntil(showDaily());
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = (event.notification.data?.url as string) || self.registration.scope;
  event.waitUntil((async () => {
    const all = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    const existing = all.find((c) => c.url.startsWith(self.registration.scope));
    if (existing) return existing.focus();
    return self.clients.openWindow(url);
  })());
});

// Le navigateur a renouvelé l'abonnement : on prévient le serveur.
self.addEventListener('pushsubscriptionchange', (event) => {
  event.waitUntil((async () => {
    try {
      const settings = await loadSettings();
      if (!settings.notifications.enabled) return;
      const sub = await self.registration.pushManager.subscribe(subscribeOptions());
      await registerOnServer(sub, settings.notifications.hour);
    } catch { /* réessayé au prochain démarrage de l'appli */ }
  })());
});
