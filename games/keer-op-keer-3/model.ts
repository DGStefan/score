/**
 * Keer op Keer 3: blad, bonussen en X-chips.
 * Het raster, de aansluitregel en de kleuren komen van Keer op Keer; nieuw zijn
 * ruitjes, kruispunten (I/II/III), de pas-balk, de joker-balk en de X-chips.
 * Er zijn geen punten: wie het eerst zijn 10 X-chips kwijt is, wint.
 */
import { LABELS, type Layout } from '../keer-op-keer/layouts';
import { cellsOf, colorProgress, isColumnComplete, width, type SheetMarks } from '../keer-op-keer/scoring';
import type { ColorKey } from '../keer-op-keer/layouts';

export const ROW_LABELS = ['P', 'Q', 'R', 'S', 'T', 'U', 'V'];
export const X_CHIPS = 10;
export const JOKER_SLOTS = 14;
export const JOKERS_START = 2;
export const BOMB_CELLS = 4;
export const DIAMONDS_PER_ROW = 5;

/** Hoofdletter = vakje met een ruitje. */
export const LAYOUT3: Layout = {
  id: 'kok3',
  name: 'Keer op Keer 3',
  description: 'Keer op Keer 3',
  grid: [
    'rrobYyroooRyyyy',
    'byoBbyyybbrYygg',
    'GyybobbBbrrrbbg',
    'ybBoooOrrgooobb',
    'ygggggorGggboOb',
    'oOrygRggygbbRrO',
    'oorrrrggyYyggrr',
  ],
  columnLabels: LABELS,
  startColumn: 7,
  columnPoints: LABELS.map(() => [0, 0] as [number, number]),
  colorBonus: [0, 0],
  jokers: JOKER_SLOTS,
  starPenalty: 0,
};

/** Soorten bonus op het blad. */
export type Bonus = 'x' | 'joker' | 'pass' | 'bomb' | 'block' | 'row3';

/** Kolombonussen: [roze rand = alleen de eerste, wit = iedereen]. */
export const COLUMN_BONUS: [Bonus | null, Bonus | null][] = [
  ['joker', 'x'], ['joker', 'x'], ['x', 'joker'], ['x', 'joker'], ['x', 'joker'],
  ['pass', null], ['pass', null], ['pass', null], ['pass', null], ['pass', null],
  ['x', 'joker'], ['x', 'joker'], ['x', 'joker'], ['joker', 'x'], ['joker', 'x'],
];

/** Ruitjesrijen (3 × 5): [roze, wit]. */
export const DIAMOND_BONUS: [Bonus, Bonus][] = [
  ['pass', 'x'],
  ['pass', 'x'],
  ['x', 'x'],
];

/**
 * Kruispunten: het punt ligt op de hoek linksboven van vakje (row, col).
 * "Omsingeld" als de vier vakjes eromheen allemaal zijn afgekruist.
 */
export const CROSSINGS: { roman: 1 | 2 | 3; row: number; col: number }[] = [
  { roman: 1, row: 2, col: 3 },
  { roman: 1, row: 3, col: 14 },
  { roman: 1, row: 5, col: 11 },
  { roman: 1, row: 6, col: 7 },
  { roman: 2, row: 1, col: 5 },
  { roman: 2, row: 1, col: 13 },
  { roman: 2, row: 2, col: 10 },
  { roman: 2, row: 6, col: 2 },
  { roman: 3, row: 3, col: 12 },
  { roman: 3, row: 4, col: 1 },
  { roman: 3, row: 4, col: 9 },
  { roman: 3, row: 5, col: 4 },
];
export const CROSSINGS_PER_ROMAN = 4;

/** Pas-balk: 16 vakjes van boven naar beneden; donkere vakjes geven een bonus. */
export const PASS_FIELDS = 16;
export const PASS_BONUS: Record<number, Bonus> = { 1: 'joker', 3: 'joker', 5: 'block', 8: 'bomb', 11: 'row3' };
/** Het laatste vakje: roze ✕ (eerste) + wit ✕. */
export const PASS_END = PASS_FIELDS - 1;

export interface Sheet3 extends SheetMarks {
  /** Roze bonussen die een ander al eerder had (per sleutel). */
  taken: Record<string, boolean>;
  /** Zelf afgekruiste vakjes op de pas-balk (bovenop die van ◇-bonussen). */
  passManual: number;
  bombsUsed: number;
  /** Vakjes die je nog vrij mag kruisen (bom). */
  freeCrosses: number;
  /** Startcombinatie (voor het passen). */
  startColor: ColorKey | null;
  startNumber: number | null;
}

export function emptySheet3(): Sheet3 {
  return {
    crossed: cellsOf(LAYOUT3).map(() => false),
    columnTaken: LABELS.map(() => false),
    colorTaken: { g: false, y: false, b: false, r: false, o: false },
    jokersUsed: 0,
    taken: {},
    passManual: 0,
    bombsUsed: 0,
    freeCrosses: 0,
    startColor: null,
    startNumber: null,
  };
}

const W = width(LAYOUT3);
const crossedAt = (s: Sheet3, row: number, col: number): boolean => Boolean(s.crossed[row * W + col]);

export function isRowComplete(s: Sheet3, row: number): boolean {
  return Array.from({ length: W }, (_, c) => c).every((c) => crossedAt(s, row, c));
}

export function isDiamond(row: number, col: number): boolean {
  const ch = LAYOUT3.grid[row]?.[col] ?? 'x';
  return ch !== ch.toLowerCase();
}

export function diamondsCrossed(s: Sheet3): number {
  return cellsOf(LAYOUT3).filter((c) => c.star && s.crossed[c.index]).length;
}

export function crossingDone(s: Sheet3, p: { row: number; col: number }): boolean {
  return (
    crossedAt(s, p.row - 1, p.col - 1) && crossedAt(s, p.row - 1, p.col) && crossedAt(s, p.row, p.col - 1) && crossedAt(s, p.row, p.col)
  );
}

/** Aantal omsingelde kruispunten per romeins cijfer (index 0 = I). */
export function crossingCounts(s: Sheet3): [number, number, number] {
  const counts: [number, number, number] = [0, 0, 0];
  for (const p of CROSSINGS) if (crossingDone(s, p)) counts[p.roman - 1] = (counts[p.roman - 1] ?? 0) + 1;
  return counts;
}

export interface Earned {
  key: string;
  bonus: Bonus;
  /** Roze bonus: alleen voor wie het als eerste haalt. */
  first: boolean;
  label: string;
}

/** Alle bonussen die dit blad nu oplevert (roze die een ander eerder had, tellen niet). */
export function earnedBonuses(s: Sheet3): { list: Earned[]; passFilled: number } {
  const list: Earned[] = [];
  const add = (key: string, bonus: Bonus | null, first: boolean, label: string): void => {
    if (!bonus) return;
    if (first && s.taken[key]) return;
    list.push({ key, bonus, first, label });
  };

  LABELS.forEach((letter, col) => {
    if (!isColumnComplete(LAYOUT3, s, col)) return;
    const [pink, white] = COLUMN_BONUS[col] ?? [null, null];
    add(`kol-${col}`, pink, true, `kolom ${letter}`);
    add(`kol-${col}-wit`, white, false, `kolom ${letter}`);
  });

  ROW_LABELS.forEach((letter, row) => {
    if (isRowComplete(s, row)) add(`rij-${row}`, 'x', false, `rij ${letter}`);
  });

  const progress = colorProgress(LAYOUT3, s);
  (Object.keys(progress) as ColorKey[]).forEach((c) => {
    const p = progress[c];
    if (p.total > 0 && p.done === p.total) {
      add(`kleur-${c}`, 'x', true, 'kleur vol');
      add(`kleur-${c}-wit`, 'x', false, 'kleur vol');
    }
  });

  const dia = diamondsCrossed(s);
  DIAMOND_BONUS.forEach(([pink, white], k) => {
    if (dia >= (k + 1) * DIAMONDS_PER_ROW) {
      add(`ruit-${k}`, pink, true, `ruitjes rij ${k + 1}`);
      add(`ruit-${k}-wit`, white, false, `ruitjes rij ${k + 1}`);
    }
  });

  const counts = crossingCounts(s);
  counts.forEach((n, k) => {
    if (n >= CROSSINGS_PER_ROMAN) {
      add(`kruis-${k}`, 'x', true, `kruispunten ${'I'.repeat(k + 1)}`);
      add(`kruis-${k}-wit`, 'x', false, `kruispunten ${'I'.repeat(k + 1)}`);
    }
  });
  for (let j = 0; j < CROSSINGS_PER_ROMAN; j++) {
    if (counts.every((n) => n > j)) add(`kruiskol-${j}`, 'x', false, 'kruispunten I+II+III');
  }

  // Pas-balk: eigen vakjes + ◇-bonussen
  const passFilled = Math.min(PASS_FIELDS, s.passManual + list.filter((e) => e.bonus === 'pass').length);
  for (let i = 0; i < passFilled; i++) {
    const b = PASS_BONUS[i];
    if (b) add(`pas-${i}`, b, false, 'pas-balk');
  }
  if (passFilled >= PASS_FIELDS) {
    add('pas-eind', 'x', true, 'einde pas-balk');
    add('pas-eind-wit', 'x', false, 'einde pas-balk');
  }

  return { list, passFilled };
}

export interface Status {
  chipsDropped: number;
  jokersUnlocked: number;
  jokersLeft: number;
  bombsPending: number;
  passFilled: number;
  crossedCount: number;
  fullColumns: number;
  earned: Earned[];
}

export function status(s: Sheet3): Status {
  const { list, passFilled } = earnedBonuses(s);
  const count = (b: Bonus): number => list.filter((e) => e.bonus === b).length;
  const jokersUnlocked = Math.min(JOKER_SLOTS, JOKERS_START + count('joker'));
  return {
    chipsDropped: Math.min(X_CHIPS, count('x')),
    jokersUnlocked,
    jokersLeft: Math.max(0, jokersUnlocked - s.jokersUsed),
    bombsPending: Math.max(0, count('bomb') - s.bombsUsed),
    passFilled,
    crossedCount: s.crossed.filter(Boolean).length,
    fullColumns: LABELS.filter((_, c) => isColumnComplete(LAYOUT3, s, c)).length,
    earned: list,
  };
}

/** Is de pink bonus met deze sleutel al door een ander gehaald? Wisselt om. */
export function toggleTaken(s: Sheet3, key: string): Sheet3 {
  return { ...s, taken: { ...s.taken, [key]: !s.taken[key] } };
}
