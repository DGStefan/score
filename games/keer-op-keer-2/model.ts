/**
 * Keer op Keer 2: blad, extra regels en puntentelling.
 * Hergebruikt het raster en de basis-telling van Keer op Keer; daarbovenop komen
 * rijen (P–V), harten, speciale dobbelstenen en bommen.
 */
import { LABELS, type Layout } from '../keer-op-keer/layouts';
import {
  cellsOf,
  emptyMarks,
  isColumnComplete,
  score as baseScore,
  width,
  type SheetMarks,
} from '../keer-op-keer/scoring';

export const ROW_LABELS = ['P', 'Q', 'R', 'S', 'T', 'U', 'V'];
export const ROW_POINTS = 5;
export const MAX_HEARTS = 5;
export const DICE_SLOTS = 9;
export const BOMB_CELLS = 4;
export const DIE_POINTS = 2;

export type RowBonus = 'die' | 'bomb' | 'heart';
export const ROW_BONUS: RowBonus[] = ['die', 'bomb', 'heart', 'bomb', 'die', 'heart', 'bomb'];

/** Vakjes met een gouden dobbelsteen: rij, kolom (0-gebaseerd). */
export const DIE_CELLS: [number, number][] = [
  [2, 2],
  [2, 14],
  [3, 4],
  [4, 11],
  [6, 5],
];

export const LAYOUT2: Layout = {
  id: 'kok2-blad-1',
  name: 'Blad 1',
  description: 'Keer op Keer 2',
  grid: [
    'rrOyyRrggyYOoob',
    'byyyoorrbByyroo',
    'bybbbooObggyrro',
    'oBbGbyybooggGrr',
    'oorrgbbbyooryyY',
    'ggroggGyyrrrbBg',
    'YggoRggyRrbbbgg',
  ],
  columnLabels: LABELS,
  startColumn: 7,
  columnPoints: [
    [5, 3], [3, 2], [3, 2], [3, 2], [2, 1], [2, 1], [2, 1], [2, 0],
    [2, 1], [2, 1], [2, 1], [3, 2], [3, 2], [3, 2], [5, 3],
  ],
  colorBonus: [5, 3],
  jokers: 6,
  starPenalty: 2,
};

export interface Sheet2 extends SheetMarks {
  /** Een ander was eerder met deze rij: geen rijbonus meer (wel de 5 punten). */
  rowTaken: boolean[];
  /** Harten omcirkeld via de speciale dobbelsteen (rijbonussen tellen automatisch). */
  heartsFromDice: number;
  /** Gebruikte speciale dobbelstenen. */
  diceUsed: number;
  /** Hoeveel verdiende rij-bommen al zijn ingezet. */
  bombsUsed: number;
  /** Hartwaarde die bij een kolom is genoteerd toen hij vol was. */
  colHeart: (number | null)[];
  /** Bom actief: zoveel vakjes mogen nog vrij (zonder aansluiting) gekruist worden. */
  freeCrosses: number;
}

export function emptySheet2(): Sheet2 {
  return {
    ...emptyMarks(LAYOUT2),
    rowTaken: ROW_LABELS.map(() => false),
    heartsFromDice: 0,
    diceUsed: 0,
    bombsUsed: 0,
    colHeart: LAYOUT2.columnPoints.map(() => null),
    freeCrosses: 0,
  };
}

const W = width(LAYOUT2);

export function isRowComplete(s: Sheet2, row: number): boolean {
  return Array.from({ length: W }, (_, c) => s.crossed[row * W + c]).every(Boolean);
}

/** Rijbonus verdiend: rij vol en niemand was eerder. */
function rowBonusEarned(s: Sheet2, kind: RowBonus): number {
  return ROW_BONUS.filter((k, r) => k === kind && isRowComplete(s, r) && !s.rowTaken[r]).length;
}

export function heartsCircled(s: Sheet2): number {
  return Math.min(MAX_HEARTS, s.heartsFromDice + rowBonusEarned(s, 'heart'));
}

export function isDieCell(row: number, col: number): boolean {
  return DIE_CELLS.some(([r, c]) => r === row && c === col);
}

export function diceEarned(s: Sheet2): number {
  const fromCells = DIE_CELLS.filter(([r, c]) => s.crossed[r * W + c]).length;
  const fromH = isColumnComplete(LAYOUT2, s, LAYOUT2.startColumn) ? 1 : 0;
  return Math.min(DICE_SLOTS, 1 + fromCells + rowBonusEarned(s, 'die') + fromH);
}

export function bombsPending(s: Sheet2): number {
  return Math.max(0, rowBonusEarned(s, 'bomb') - s.bombsUsed);
}

/**
 * Na elke wijziging: noteer bij nieuw volle kolommen de huidige hartwaarde
 * (eerst rijbonussen, dan kolommen — zoals de regels voorschrijven).
 */
export function settleHearts(prev: Sheet2, next: Sheet2): Sheet2 {
  const hearts = heartsCircled(next);
  const colHeart = next.colHeart.map((v, col) => {
    const full = isColumnComplete(LAYOUT2, next, col);
    if (!full) return null;
    const wasFull = isColumnComplete(LAYOUT2, prev, col);
    return wasFull && v !== null ? v : hearts;
  });
  return { ...next, colHeart };
}

export interface Score2 {
  colors: number;
  columns: number;
  rows: number;
  hearts: number;
  jokers: number;
  dice: number;
  stars: number;
  total: number;
  completeColors: string[];
}

export function score2(s: Sheet2): Score2 {
  const base = baseScore(LAYOUT2, s);
  const rows = ROW_LABELS.filter((_, r) => isRowComplete(s, r)).length * ROW_POINTS;
  const hearts = s.colHeart.reduce<number>((sum, v, col) => sum + (v !== null && isColumnComplete(LAYOUT2, s, col) ? v : 0), 0);
  const dice = Math.max(0, diceEarned(s) - s.diceUsed) * DIE_POINTS;
  const total = base.colors + base.columns + rows + hearts + base.jokers + dice + base.stars;
  return { colors: base.colors, columns: base.columns, rows, hearts, jokers: base.jokers, dice, stars: base.stars, total, completeColors: base.completeColors };
}

export { cellsOf };
