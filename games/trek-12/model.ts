import { neighbours, type Mountain } from './mountains';

/** De vijf keuzes van de dobbelstenen, in de volgorde van het blad. */
export type Op = 'laag' | 'hoog' | 'min' | 'plus' | 'keer';

export const OPS: { key: Op; symbol: string; name: string }[] = [
  { key: 'laag', symbol: '↓', name: 'Laagste' },
  { key: 'hoog', symbol: '↑', name: 'Hoogste' },
  { key: 'min', symbol: '−', name: 'Verschil' },
  { key: 'plus', symbol: '+', name: 'Som' },
  { key: 'keer', symbol: '×', name: 'Product' },
];

export const TICKS_PER_OP = 4;
export const MAX_NUMBER = 12;
export const DANGER_MAX = 6;
export const SKULL_POINTS = 3;
export const CARD_POINTS = 3;
export const MAX_CARDS = 3;

/** Een rondje: leeg, een getal, of een doodshoofd (mislukt). */
export type Cell = number | 'skull' | null;

export type GroupKind = 'line' | 'zone';

export interface Group {
  kind: GroupKind;
  cells: number[];
}

export interface Sheet {
  cells: Cell[];
  ticks: Record<Op, number>;
  groups: Group[];
  /** Ongebruikte hulpkaarten (expeditie): 3 punten per stuk. */
  cards: number;
}

export function emptySheet(m: Mountain): Sheet {
  return {
    cells: m.spots.map(() => null),
    ticks: { laag: 0, hoog: 0, min: 0, plus: 0, keer: 0 },
    groups: [],
    cards: 0,
  };
}

export function opValue(op: Op, red: number, yellow: number): number {
  switch (op) {
    case 'laag':
      return Math.min(red, yellow);
    case 'hoog':
      return Math.max(red, yellow);
    case 'min':
      return Math.abs(red - yellow);
    case 'plus':
      return red + yellow;
    case 'keer':
      return red * yellow;
  }
}

const adjacencyCache = new WeakMap<Mountain, number[][]>();
export function adjacency(m: Mountain): number[][] {
  let adj = adjacencyCache.get(m);
  if (!adj) {
    adj = neighbours(m);
    adjacencyCache.set(m, adj);
  }
  return adj;
}

export function filledCount(s: Sheet): number {
  return s.cells.filter((c) => c !== null).length;
}

/** Mag hier nu iets in? Eerste getal overal, daarna grenzend aan een gevuld rondje. */
export function canPlace(m: Mountain, s: Sheet, i: number): boolean {
  if (s.cells[i] !== null) return false;
  if (filledCount(s) === 0) return true;
  return adjacency(m)[i]?.some((j) => s.cells[j] !== null) ?? false;
}

/** Wat er werkelijk in het rondje komt: het getal, of een doodshoofd als het niet past. */
export function resultFor(m: Mountain, i: number, value: number): Cell {
  const max = m.spots[i]?.danger ? DANGER_MAX : MAX_NUMBER;
  return value > max ? 'skull' : value;
}

export function place(m: Mountain, s: Sheet, i: number, op: Op, value: number): Sheet {
  const cells = [...s.cells];
  cells[i] = resultFor(m, i, value);
  return { ...s, cells, ticks: { ...s.ticks, [op]: s.ticks[op] + 1 } };
}

/* ------------------------------------------------------------------ */
/* Groepen: lijnen en zones                                            */
/* ------------------------------------------------------------------ */

function isConnected(adj: number[][], cells: number[]): boolean {
  const set = new Set(cells);
  const seen = new Set<number>([cells[0] as number]);
  const stack = [cells[0] as number];
  while (stack.length) {
    const c = stack.pop() as number;
    for (const n of adj[c] ?? []) {
      if (set.has(n) && !seen.has(n)) {
        seen.add(n);
        stack.push(n);
      }
    }
  }
  return seen.size === set.size;
}

/** De rondjes van een lijn, gesorteerd van laag naar hoog. */
export function lineOrder(s: Sheet, cells: number[]): number[] {
  return [...cells].sort((a, b) => (s.cells[a] as number) - (s.cells[b] as number));
}

export type Check = { ok: true; kind: GroupKind; points: number } | { ok: false; reason: string };

/**
 * Past deze selectie als lijn of als zone?
 * - Lijn: aaneengesloten pad met unieke, opeenvolgende getallen (bv. 4-5-6-7).
 * - Zone: aaneengesloten groep met allemaal hetzelfde getal.
 * Een rondje mag in één lijn én in één zone zitten, maar niet in twee lijnen of twee zones.
 */
export function checkGroup(m: Mountain, s: Sheet, cells: number[]): Check {
  if (cells.length < 2) return { ok: false, reason: 'Kies minstens 2 rondjes.' };
  const values = cells.map((c) => s.cells[c]);
  if (values.some((v) => typeof v !== 'number')) return { ok: false, reason: 'Een doodshoofd hoort nergens bij.' };
  const nums = values as number[];
  const adj = adjacency(m);

  const allSame = nums.every((n) => n === nums[0]);
  if (allSame) {
    if (!isConnected(adj, cells)) return { ok: false, reason: 'Een zone moet aan elkaar vastzitten.' };
    if (s.groups.some((g) => g.kind === 'zone' && g.cells.some((c) => cells.includes(c))))
      return { ok: false, reason: 'Een rondje zit al in een andere zone.' };
    return { ok: true, kind: 'zone', points: groupPoints(s, { kind: 'zone', cells }) };
  }

  const sorted = lineOrder(s, cells);
  const sv = sorted.map((c) => s.cells[c] as number);
  for (let k = 1; k < sv.length; k++) {
    if (sv[k] !== (sv[k - 1] as number) + 1)
      return { ok: false, reason: 'Een lijn heeft opeenvolgende, unieke getallen (bv. 4-5-6) — of kies gelijke getallen voor een zone.' };
    if (!adj[sorted[k - 1] as number]?.includes(sorted[k] as number))
      return { ok: false, reason: `${sv[k - 1]} en ${sv[k]} liggen niet naast elkaar.` };
  }
  if (s.groups.some((g) => g.kind === 'line' && g.cells.some((c) => cells.includes(c))))
    return { ok: false, reason: 'Een rondje zit al in een andere lijn.' };
  return { ok: true, kind: 'line', points: groupPoints(s, { kind: 'line', cells }) };
}

/** Hoogste (lijn) of gedeelde (zone) getal + 1 per ander rondje. */
export function groupPoints(s: Sheet, g: Group): number {
  const nums = g.cells.map((c) => s.cells[c] as number);
  return Math.max(...nums) + g.cells.length - 1;
}

export function bonusFor(m: Mountain, size: number): number {
  const last = m.bonus.length - 1;
  if (size <= last) return m.bonus[size] ?? 0;
  return (m.bonus[last] ?? 0) + (size - last) * m.bonusExtra;
}

/** Gevulde rondjes die in geen enkele lijn of zone zitten. */
export function orphans(s: Sheet): number[] {
  const used = new Set(s.groups.flatMap((g) => g.cells));
  return s.cells.flatMap((c, i) => (typeof c === 'number' && !used.has(i) ? [i] : []));
}

export interface Score {
  lines: number[];
  zones: number[];
  lineBonus: number;
  zoneBonus: number;
  lineTotal: number;
  zoneTotal: number;
  cards: number;
  skulls: number;
  orphans: number;
  penalty: number;
  total: number;
}

/** `final`: losse rondjes tellen pas mee bij de telling. */
export function score(m: Mountain, s: Sheet, final = true): Score {
  const lineGroups = s.groups.filter((g) => g.kind === 'line');
  const zoneGroups = s.groups.filter((g) => g.kind === 'zone');
  const lines = lineGroups.map((g) => groupPoints(s, g));
  const zones = zoneGroups.map((g) => groupPoints(s, g));
  const lineBonus = bonusFor(m, Math.max(0, ...lineGroups.map((g) => g.cells.length)));
  const zoneBonus = bonusFor(m, Math.max(0, ...zoneGroups.map((g) => g.cells.length)));
  const lineTotal = lines.reduce((a, b) => a + b, 0) + lineBonus;
  const zoneTotal = zones.reduce((a, b) => a + b, 0) + zoneBonus;
  const skulls = s.cells.filter((c) => c === 'skull').length;
  const orphanCount = final ? orphans(s).length : 0;
  const penalty = (skulls + orphanCount) * SKULL_POINTS;
  const cards = s.cards * CARD_POINTS;
  return {
    lines,
    zones,
    lineBonus,
    zoneBonus,
    lineTotal,
    zoneTotal,
    cards,
    skulls,
    orphans: orphanCount,
    penalty,
    total: lineTotal + zoneTotal + cards - penalty,
  };
}
