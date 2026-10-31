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
  watchForUpdates(root);
  if (keepAwake) keepScreenOn();
}

/**
 * Nieuwe versie online? Bij openen en bij terugkomen in de app vragen we /version.json op
 * (nooit uit een cache). Wijkt die af van de versie waarmee deze pagina gebouwd is,
 * dan verschijnt een balk "Nieuwe versie" met een knop om te vernieuwen.
 * Je spelstand staat in localStorage en blijft bij vernieuwen gewoon bewaard.
 */
function watchForUpdates(root: string): void {
  if (!import.meta.env.PROD) return;
  let shown = false;
  const check = async (): Promise<void> => {
    if (shown || document.visibilityState !== 'visible') return;
    try {
      const res = await fetch(new URL(`${root}version.json`, location.href), { cache: 'no-store' });
      if (!res.ok) return;
      const { build } = (await res.json()) as { build?: string };
      if (build && build !== __BUILD_ID__) {
        shown = true;
        showUpdateBar();
      }
    } catch {
      /* offline: niets aan de hand */
    }
  };
  window.addEventListener('load', () => void check());
  document.addEventListener('visibilitychange', () => void check());
}

function showUpdateBar(): void {
  const bar = document.createElement('div');
  bar.className = 'update-bar';
  bar.setAttribute('role', 'status');
  const text = document.createElement('span');
  text.textContent = 'Er is een nieuwe versie van Scores.';
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'btn-primary';
  button.textContent = 'Vernieuwen';
  button.addEventListener('click', () => void hardReload());
  bar.append(text, button);
  document.body.append(bar);
}

/** Oude service worker en cache weg, daarna de pagina vers ophalen. Spelstanden blijven staan. */
async function hardReload(): Promise<void> {
  try {
    const regs = (await navigator.serviceWorker?.getRegistrations()) ?? [];
    await Promise.all(regs.map((r) => r.update().catch(() => undefined)));
    const keys = (await caches?.keys()) ?? [];
    await Promise.all(keys.map((k) => caches.delete(k)));
  } catch {
    /* geen service worker of cache: gewoon herladen */
  }
  location.reload();
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
