import { render } from 'preact';
import { App } from './app';
import { initPWA } from './pwa';
import './styles.css';

initPWA();

// Demande au navigateur de ne pas effacer les données en cas de manque d'espace.
void navigator.storage?.persist?.();

render(<App />, document.getElementById('app')!);
