import { readJSON, writeJSON } from './storage';

const KEY = 'spelers:recent';
const MAX = 12;

/** Recent gebruikte namen, zodat je ze niet steeds opnieuw hoeft te typen. */
export function getRecentPlayers(): string[] {
  return readJSON<string[]>(KEY, []);
}

export function rememberPlayers(names: string[]): void {
  const merged = [...names, ...getRecentPlayers()];
  const seen = new Set<string>();
  const unique = merged.filter((name) => {
    const k = name.trim().toLowerCase();
    if (!k || seen.has(k)) return false;
    seen.add(k);
    return true;
  });
  writeJSON(KEY, unique.slice(0, MAX));
}
