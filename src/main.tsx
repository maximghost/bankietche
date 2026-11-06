import { render } from 'preact';
import { App } from './app';
import { initPWA } from './pwa';
import './styles.css';

initPWA();

// Demande au navigateur de ne pas effacer les données en cas de manque d'espace.
void navigator.storage?.persist?.();

render(<App />, document.getElementById('app')!);

/**
 * Écran de lancement (défini dans index.html) : visible au moins le temps de
 * son animation (~1,9 s depuis l'ouverture), puis fondu de sortie.
 * Avec « réduire les animations », il disparaît aussitôt l'appli prête.
 */
const splash = document.getElementById('splash');
if (splash) {
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const MIN_VISIBLE_MS = reduced ? 250 : 1900;
  const wait = Math.max(0, MIN_VISIBLE_MS - performance.now());
  window.setTimeout(() => {
    splash.classList.add('out');
    window.setTimeout(() => splash.remove(), reduced ? 0 : 420);
  }, wait);
}
