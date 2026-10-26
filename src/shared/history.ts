import { readJSON, uid, writeJSON } from './storage';

export type WinMode = 'hoogste' | 'laagste';

export interface PlayerResult {
  name: string;
  score: number;
}

export interface HistoryEntry {
  id: string;
  gameId: string;
  title: string;
  finishedAt: string; // ISO-datum
  players: PlayerResult[];
  winners: string[];
}

const KEY = 'geschiedenis';
const MAX_ENTRIES = 200;

export function getHistory(): HistoryEntry[] {
  return readJSON<HistoryEntry[]>(KEY, []);
}

export function addHistory(entry: Omit<HistoryEntry, 'id' | 'finishedAt'>): HistoryEntry {
  const full: HistoryEntry = { ...entry, id: uid(), finishedAt: new Date().toISOString() };
  writeJSON(KEY, [full, ...getHistory()].slice(0, MAX_ENTRIES));
  return full;
}

export function removeHistory(id: string): void {
  writeJSON(KEY, getHistory().filter((e) => e.id !== id));
}

export function clearHistory(): void {
  writeJSON(KEY, []);
}

export function determineWinners(players: PlayerResult[], mode: WinMode): string[] {
  if (players.length === 0) return [];
  const scores = players.map((p) => p.score);
  const best = mode === 'hoogste' ? Math.max(...scores) : Math.min(...scores);
  return players.filter((p) => p.score === best).map((p) => p.name);
}
