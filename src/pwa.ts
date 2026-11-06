import { useEffect, useState } from 'preact/hooks';
import { registerSW } from 'virtual:pwa-register';

/** Enregistrement du service worker + mise à jour à la demande de l'utilisateur. */

let applyUpdate: ((reload?: boolean) => Promise<void>) | null = null;
const UPDATE_EVENT = 'bk:update-ready';

export function initPWA() {
  applyUpdate = registerSW({
    onNeedRefresh() {
      window.dispatchEvent(new Event(UPDATE_EVENT));
    },
  });
}

export function useUpdateAvailable(): [boolean, () => void] {
  const [ready, setReady] = useState(false);
  useEffect(() => {
    const on = () => setReady(true);
    window.addEventListener(UPDATE_EVENT, on);
    return () => window.removeEventListener(UPDATE_EVENT, on);
  }, []);
  return [ready, () => void applyUpdate?.(true)];
}

/** Invite d'installation (Chrome / Android). */
interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

let deferredPrompt: BeforeInstallPromptEvent | null = null;
const INSTALL_EVENT = 'bk:install-available';

window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  deferredPrompt = e as BeforeInstallPromptEvent;
  window.dispatchEvent(new Event(INSTALL_EVENT));
});

export function isStandalone(): boolean {
  return window.matchMedia('(display-mode: standalone)').matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true;
}

export function isIOS(): boolean {
  return /iphone|ipad|ipod/i.test(navigator.userAgent);
}

export function useInstallPrompt(): [boolean, () => Promise<void>] {
  const [available, setAvailable] = useState(deferredPrompt !== null);
  useEffect(() => {
    const on = () => setAvailable(true);
    window.addEventListener(INSTALL_EVENT, on);
    return () => window.removeEventListener(INSTALL_EVENT, on);
  }, []);
  const install = async () => {
    if (!deferredPrompt) return;
    await deferredPrompt.prompt();
    await deferredPrompt.userChoice;
    deferredPrompt = null;
    setAvailable(false);
  };
  return [available, install];
}
