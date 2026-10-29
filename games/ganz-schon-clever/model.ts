/**
 * Clever: indeling van het blad, bonussen en puntentelling.
 * Alles wat je verdient (bonussen, vossen, herworpen, +1) wordt AFGELEID uit wat er
 * is afgekruist; opgeslagen wordt alleen wat de speler zelf invult.
 */

export type Area = 'yellow' | 'blue' | 'green' | 'orange' | 'purple';

export type BonusKind =
  | 'reroll' // herworp erbij
  | 'plus' // +1-actie erbij
  | 'fox' // vos
  | 'yellowX' // kruis een vakje in geel naar keuze
  | 'blueX'
  | 'greenX' // kruis het volgende vakje in groen
  | 'orange4'
  | 'orange5'
  | 'orange6'
  | 'purple6'
  | 'anyX6'; // ronde 4: vrij kruisje in geel/blauw/groen óf een 6 in oranje/paars

export interface Bonus {
  id: string;
  kind: BonusKind;
  from: string;
}

/* ---------------- Geel: 4×4, vier vakjes al afgekruist ---------------- */
export const YELLOW_VALUES = [
  [3, 6, 5, 0],
  [2, 1, 0, 5],
  [1, 0, 2, 4],
  [0, 3, 4, 6],
];
/** Vooraf afgekruist (de diagonaal van rechtsboven naar linksonder). */
export const YELLOW_PRESET = (r: number, c: number): boolean => r + c === 3;
export const YELLOW_ROW_BONUS: BonusKind[] = ['blueX', 'orange4', 'greenX', 'fox'];
export const YELLOW_COL_POINTS = [10, 14, 16, 20];
/** Diagonaal linksboven → rechtsonder levert een +1 op. */
export const YELLOW_DIAGONAL_BONUS: BonusKind = 'plus';

/* ---------------- Blauw: som van blauw + wit (2–12) ---------------- */
/** Raster 3×4; null = het vakje met het dobbelsteen-icoon (geen veld). */
export const BLUE_GRID: (number | null)[][] = [
  [null, 2, 3, 4],
  [5, 6, 7, 8],
  [9, 10, 11, 12],
];
export const BLUE_ROW_BONUS: BonusKind[] = ['orange5', 'yellowX', 'fox'];
export const BLUE_COL_BONUS: BonusKind[] = ['reroll', 'greenX', 'purple6', 'plus'];
export const BLUE_POINTS = [0, 1, 2, 4, 7, 11, 16, 22, 29, 37, 46, 56];

/* ---------------- Groen: van links naar rechts, waarde ≥ drempel ---------------- */
export const GREEN_MIN = [1, 2, 3, 4, 5, 1, 2, 3, 4, 5, 6];
export const GREEN_POINTS = [0, 1, 3, 6, 10, 15, 21, 28, 36, 45, 55, 66];
export const GREEN_BONUS: Record<number, BonusKind> = { 3: 'plus', 5: 'blueX', 6: 'fox', 8: 'purple6', 9: 'reroll' };

/* ---------------- Oranje: waarde invullen, sommige ×2 / ×3 ---------------- */
export const ORANGE_MULT = [1, 1, 1, 2, 1, 1, 2, 1, 2, 1, 3];
export const ORANGE_BONUS: Record<number, BonusKind> = { 2: 'reroll', 4: 'yellowX', 5: 'plus', 7: 'fox', 9: 'purple6' };

/* ---------------- Paars: steeds hoger, behalve na een 6 ---------------- */
export const PURPLE_BONUS: Record<number, BonusKind> = {
  2: 'reroll',
  3: 'blueX',
  4: 'plus',
  5: 'yellowX',
  6: 'fox',
  7: 'reroll',
  8: 'greenX',
  9: 'orange6',
  10: 'plus',
};

/* ---------------- Rondes ---------------- */
export const ROUND_BONUS: (BonusKind | null)[] = ['reroll', 'plus', 'reroll', 'anyX6', null, null];
export const TRACK_SIZE = 7;

export interface Sheet {
  /** Geel: per vakje (rij*4+kolom) afgekruist door de speler. */
  yellow: boolean[];
  /** Blauw: afgekruiste sommen. */
  blue: number[];
  /** Groen: aantal ingevulde vakjes. */
  green: number;
  /** Oranje en paars: ingevulde waarden. */
  orange: number[];
  purple: number[];
  /** Aantal gemarkeerde rondes. */
  rounds: number;
  /** Hoeveel herworpen en +1's al gebruikt zijn. */
  rerollsUsed: number;
  plusUsed: number;
  /** Afgehandelde bonussen (id's). */
  bonusDone: string[];
}

export function emptySheet(): Sheet {
  return {
    yellow: Array.from({ length: 16 }, () => false),
    blue: [],
    green: 0,
    orange: [],
    purple: [],
    rounds: 0,
    rerollsUsed: 0,
    plusUsed: 0,
    bonusDone: [],
  };
}

export function yellowCrossed(s: Sheet, r: number, c: number): boolean {
  return YELLOW_PRESET(r, c) || Boolean(s.yellow[r * 4 + c]);
}

const NAMES: Record<Area, string> = { yellow: 'geel', blue: 'blauw', green: 'groen', orange: 'oranje', purple: 'paars' };

/** Alle bonussen die je met dit blad hebt verdiend. */
export function earnedBonuses(s: Sheet): Bonus[] {
  const out: Bonus[] = [];
  // geel: rijen, diagonaal
  YELLOW_ROW_BONUS.forEach((kind, r) => {
    if ([0, 1, 2, 3].every((c) => yellowCrossed(s, r, c))) out.push({ id: `y-r${r}`, kind, from: `geel rij ${r + 1}` });
  });
  if ([0, 1, 2, 3].every((i) => yellowCrossed(s, i, i))) out.push({ id: 'y-diag', kind: YELLOW_DIAGONAL_BONUS, from: 'geel diagonaal' });
  // blauw: rijen en kolommen
  BLUE_ROW_BONUS.forEach((kind, r) => {
    const cells = (BLUE_GRID[r] ?? []).filter((v): v is number => v !== null);
    if (cells.every((v) => s.blue.includes(v))) out.push({ id: `b-r${r}`, kind, from: `blauw rij ${r + 1}` });
  });
  BLUE_COL_BONUS.forEach((kind, c) => {
    const cells = BLUE_GRID.map((row) => row[c]).filter((v): v is number => v !== null && v !== undefined);
    if (cells.every((v) => s.blue.includes(v))) out.push({ id: `b-c${c}`, kind, from: `blauw kolom ${c + 1}` });
  });
  // groen, oranje, paars: per bereikt vakje
  const lane = (area: Area, filled: number, table: Record<number, BonusKind>): void => {
    for (const [i, kind] of Object.entries(table)) {
      if (Number(i) < filled) out.push({ id: `${area[0]}-${i}`, kind, from: `${NAMES[area]} vakje ${Number(i) + 1}` });
    }
  };
  lane('green', s.green, GREEN_BONUS);
  lane('orange', s.orange.length, ORANGE_BONUS);
  lane('purple', s.purple.length, PURPLE_BONUS);
  // rondes
  ROUND_BONUS.forEach((kind, r) => {
    if (kind && r < s.rounds) out.push({ id: `round-${r}`, kind, from: `ronde ${r + 1}` });
  });
  return out;
}

/** Bonussen waar de speler zelf nog iets mee moet doen (kruisje of getal invullen). */
export function pendingBonuses(s: Sheet): Bonus[] {
  return earnedBonuses(s).filter((b) => !['reroll', 'plus', 'fox'].includes(b.kind) && !s.bonusDone.includes(b.id));
}

export function countKind(s: Sheet, kind: BonusKind): number {
  return earnedBonuses(s).filter((b) => b.kind === kind).length;
}

/* ---------------- Puntentelling ---------------- */

export interface Score {
  yellow: number;
  blue: number;
  green: number;
  orange: number;
  purple: number;
  foxes: number;
  foxValue: number; // laagste gebied
  fox: number;
  total: number;
}

export function score(s: Sheet): Score {
  const yellow = YELLOW_COL_POINTS.reduce((sum, pts, c) => sum + ([0, 1, 2, 3].every((r) => yellowCrossed(s, r, c)) ? pts : 0), 0);
  const blue = BLUE_POINTS[Math.min(s.blue.length, 11)] ?? 0;
  const green = GREEN_POINTS[Math.min(s.green, 11)] ?? 0;
  const orange = s.orange.reduce((sum, v, i) => sum + v * (ORANGE_MULT[i] ?? 1), 0);
  const purple = s.purple.reduce((sum, v) => sum + v, 0);
  const foxes = countKind(s, 'fox');
  const foxValue = Math.min(yellow, blue, green, orange, purple);
  const fox = foxes * foxValue;
  return { yellow, blue, green, orange, purple, foxes, foxValue, fox, total: yellow + blue + green + orange + purple + fox };
}

/** Paars: hoger dan het vorige getal, behalve na een 6 (dan mag alles). */
export function purpleAllowed(s: Sheet, value: number): boolean {
  const prev = s.purple[s.purple.length - 1];
  return prev === undefined || prev === 6 || value > prev;
}

export function bonusLabel(kind: BonusKind): string {
  switch (kind) {
    case 'reroll':
      return 'Herworp';
    case 'plus':
      return '+1';
    case 'fox':
      return 'Vos';
    case 'yellowX':
      return 'Geel ✕';
    case 'blueX':
      return 'Blauw ✕';
    case 'greenX':
      return 'Groen ✕';
    case 'orange4':
      return 'Oranje 4';
    case 'orange5':
      return 'Oranje 5';
    case 'orange6':
      return 'Oranje 6';
    case 'purple6':
      return 'Paars 6';
    case 'anyX6':
      return 'Vrij ✕ of 6';
  }
}

export function bonusHelp(kind: BonusKind): string {
  switch (kind) {
    case 'yellowX':
      return 'Kruis een vakje naar keuze in geel.';
    case 'blueX':
      return 'Kruis een vakje naar keuze in blauw.';
    case 'greenX':
      return 'Kruis het volgende vakje in groen (de drempel telt niet).';
    case 'orange4':
    case 'orange5':
    case 'orange6':
      return `Vul ${kind.slice(-1)} in het volgende vakje van oranje in.`;
    case 'purple6':
      return 'Vul 6 in het volgende vakje van paars in.';
    case 'anyX6':
      return 'Kies: een vrij kruisje in geel, blauw of groen, óf een 6 in oranje of paars.';
    default:
      return '';
  }
}

/** Kleuren van de gebieden (neon-look). */
export const AREA_COLORS: Record<Area, string> = {
  yellow: '#f5c518',
  blue: '#2e9bf0',
  green: '#3cc35a',
  orange: '#ff8a1f',
  purple: '#a259ec',
};
