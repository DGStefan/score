import { hasKey, readJSON, removeKey, writeJSON } from './storage';

/**
 * De lopende stand van één spel. Blijft bewaard tot het spel wordt
 * afgerond of gewist. `version` voorkomt dat een oude, anders opgebouwde
 * stand na een update in een nieuwe versie van het spel wordt geladen.
 */
export interface Versioned {
  version: number;
}

export interface SessionStore<T extends Versioned> {
  load(): T | null;
  save(state: T): void;
  clear(): void;
}

export const sessionKey = (gameId: string): string => `spel:${gameId}:actief`;
const touchedKey = (gameId: string): string => `spel:${gameId}:bijgewerkt`;

export function sessionStore<T extends Versioned>(gameId: string, version: number): SessionStore<T> {
  const key = sessionKey(gameId);
  return {
    load() {
      const state = readJSON<T | null>(key, null);
      return state && state.version === version ? state : null;
    },
    save(state) {
      writeJSON(key, state);
      writeJSON(touchedKey(gameId), Date.now());
    },
    clear() {
      removeKey(key);
      removeKey(touchedKey(gameId));
    },
  };
}

export function hasActiveSession(gameId: string): boolean {
  return hasKey(sessionKey(gameId));
}

/** Moment van de laatste zet in een lopend spel (ms), of null als onbekend. */
export function sessionUpdatedAt(gameId: string): number | null {
  return readJSON<number | null>(touchedKey(gameId), null);
}
