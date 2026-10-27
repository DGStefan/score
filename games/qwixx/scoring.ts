/** Qwixx: rijen, regels en puntentelling. Pure functies, los te testen. */

export type RowKey = 'red' | 'yellow' | 'green' | 'blue';

export interface RowInfo {
  key: RowKey;
  name: string;
  /** Getallen van links naar rechts. */
  numbers: number[];
  color: string;
  /** Lichte achtergrond van de vakjes */
  light: string;
}

const UP = [2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];
const DOWN = [...UP].reverse();

export const ROWS: RowInfo[] = [
  { key: 'red', name: 'Rood', numbers: UP, color: '#d7263d', light: '#fde3e6' },
  { key: 'yellow', name: 'Geel', numbers: UP, color: '#e8b200', light: '#fff4c7' },
  { key: 'green', name: 'Groen', numbers: DOWN, color: '#2e9b4b', light: '#dcf3e2' },
  { key: 'blue', name: 'Blauw', numbers: DOWN, color: '#2c6cc4', light: '#dde9fa' },
];

export const MAX_PENALTIES = 4;
export const PENALTY_POINTS = 5;
/** Minimaal aantal kruisjes in een rij voordat je het laatste getal (en het slot) mag kruisen. */
export const MIN_TO_LOCK = 5;
export const LAST_INDEX = 10;

export type LockState = null | 'self' | 'other';

export interface Sheet {
  /** Per rij de indexen (0–10) die zijn afgekruist, oplopend. */
  marks: Record<RowKey, number[]>;
  /** Afgesloten door jezelf (slot telt als extra kruisje) of door een ander. */
  locked: Record<RowKey, LockState>;
  penalties: number;
}

export function emptySheet(): Sheet {
  return {
    marks: { red: [], yellow: [], green: [], blue: [] },
    locked: { red: null, yellow: null, green: null, blue: null },
    penalties: 0,
  };
}

/** Aantal kruisjes dat telt voor de score (slot telt mee als je zelf afsloot). */
export function crossCount(sheet: Sheet, row: RowKey): number {
  return sheet.marks[row].length + (sheet.locked[row] === 'self' ? 1 : 0);
}

/** 1, 3, 6, 10, 15, 21, 28, 36, 45, 55, 66, 78 */
export function pointsFor(crosses: number): number {
  return (crosses * (crosses + 1)) / 2;
}

export type CrossCheck = { ok: true; locks: boolean } | { ok: false; reason: string };

/**
 * Mag dit vakje worden afgekruist?
 *  - van links naar rechts: alleen rechts van je laatste kruisje
 *  - niet in een afgesloten rij
 *  - het laatste getal pas na minstens 5 kruisjes in die rij (en dan sluit je de rij af)
 */
export function checkCross(sheet: Sheet, row: RowKey, index: number): CrossCheck {
  if (sheet.locked[row]) return { ok: false, reason: 'Deze rij is afgesloten' };
  const marks = sheet.marks[row];
  const last = marks[marks.length - 1];
  if (last !== undefined && index <= last) return { ok: false, reason: 'Je kruist van links naar rechts; dit vakje is overgeslagen' };
  if (index === LAST_INDEX && marks.length < MIN_TO_LOCK) {
    return { ok: false, reason: `Het laatste getal mag pas na ${MIN_TO_LOCK} kruisjes in deze rij` };
  }
  return { ok: true, locks: index === LAST_INDEX };
}

export function cross(sheet: Sheet, row: RowKey, index: number): Sheet {
  const check = checkCross(sheet, row, index);
  if (!check.ok) return sheet;
  return {
    ...sheet,
    marks: { ...sheet.marks, [row]: [...sheet.marks[row], index] },
    locked: check.locks ? { ...sheet.locked, [row]: 'self' } : sheet.locked,
  };
}

export interface Score {
  rows: Record<RowKey, number>;
  penalties: number; // negatief
  total: number;
}

export function score(sheet: Sheet): Score {
  const rows = Object.fromEntries(ROWS.map((r) => [r.key, pointsFor(crossCount(sheet, r.key))])) as Record<RowKey, number>;
  const penalties = -sheet.penalties * PENALTY_POINTS;
  const total = Object.values(rows).reduce((a, b) => a + b, 0) + penalties;
  return { rows, penalties, total };
}

/** Het spel eindigt bij 4 misworpen of zodra er 2 rijen zijn afgesloten. */
export function gameOver(sheet: Sheet): string | null {
  if (sheet.penalties >= MAX_PENALTIES) return `${MAX_PENALTIES} misworpen: het spel is afgelopen.`;
  const lockedRows = ROWS.filter((r) => sheet.locked[r.key]).length;
  if (lockedRows >= 2) return 'Twee rijen afgesloten: het spel is afgelopen.';
  return null;
}
