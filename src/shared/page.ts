import './style.css';
import { applyTheme } from './theme';

interface PageOptions {
  /** Relatief pad naar de root van de app, bv. '' voor de portal, '../../' voor een spel. */
  root: string;
  /** Scherm aanhouden tijdens het spelen. */
  keepAwake?: boolean;
}

/** Gemeenschappelijke start voor elke pagina. */
export function initPage({ root, keepAwake = false }: PageOptions): void {
  applyTheme();
  // Terug via de terugknop (bfcache) of thema gewijzigd in een ander tabblad
  window.addEventListener('pageshow', () => applyTheme());
  window.addEventListener('storage', () => applyTheme());
  registerServiceWorker(root);
  if (keepAwake) keepScreenOn();
}

function registerServiceWorker(root: string): void {
  if (!import.meta.env.PROD || !('serviceWorker' in navigator)) return;
  window.addEventListener('load', () => {
    navigator.serviceWorker.register(new URL(`${root}sw.js`, location.href)).catch((error: unknown) => {
      console.warn('Service worker niet geregistreerd', error);
    });
  });
}

function keepScreenOn(): void {
  if (!('wakeLock' in navigator)) return;
  let lock: WakeLockSentinel | null = null;
  const request = async (): Promise<void> => {
    if (document.visibilityState !== 'visible') return;
    try {
      lock = await navigator.wakeLock.request('screen');
    } catch {
      /* niet toegestaan, bv. batterijbesparing */
    }
  };
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible' && (!lock || lock.released)) void request();
  });
  void request();
}
