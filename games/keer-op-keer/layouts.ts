/**
 * Bladen (varianten) voor Keer op Keer.
 *
 * Een blad is pure data, zodat je kleuren, verdeling en punten kunt aanpassen
 * of nieuwe bladen kunt toevoegen zonder de spelcode te wijzigen.
 *
 * Raster: één string per rij, één teken per vakje.
 *   g = groen, y = geel, b = blauw, r = roze, o = oranje
 *   Hoofdletter (G, Y, B, R, O) = vakje met een ster.
 */

export type ColorKey = 'g' | 'y' | 'b' | 'r' | 'o';

export interface ColorInfo {
  name: string;
  /** Vulkleur van het vakje */
  fill: string;
  /** Kleur van kruisje/ster op dat vakje */
  ink: string;
}

export interface Layout {
  id: string;
  name: string;
  description: string;
  /** Rijen van boven naar beneden, alle even lang. */
  grid: string[];
  /** Kolomletters boven het blad. */
  columnLabels: string[];
  /** Index van de startkolom (H = 7). */
  startColumn: number;
  /** Punten per kolom: [eerste die hem vol heeft, latere spelers]. */
  columnPoints: [number, number][];
  /** Bonus per volle kleur: [eerste, later]. */
  colorBonus: [number, number];
  /** Aantal jokers (!) op het blad; elke ongebruikte joker = +1. */
  jokers: number;
  /** Minpunten per ster die niet is afgekruist. */
  starPenalty: number;
  /** Optioneel: kleuren aanpassen voor dit blad. */
  colors?: Partial<Record<ColorKey, ColorInfo>>;
}

export const DEFAULT_COLORS: Record<ColorKey, ColorInfo> = {
  g: { name: 'Groen', fill: '#76c442', ink: '#10282b' },
  y: { name: 'Geel', fill: '#fbd338', ink: '#10282b' },
  b: { name: 'Blauw', fill: '#6fcdf2', ink: '#10282b' },
  r: { name: 'Roze', fill: '#ec3a7f', ink: '#10282b' },
  o: { name: 'Oranje', fill: '#f6922f', ink: '#10282b' },
};

export const COLOR_ORDER: ColorKey[] = ['g', 'y', 'b', 'r', 'o'];

export const LABELS = 'ABCDEFGHIJKLMNO'.split('');

/** Standaard kolompunten Keer op Keer (A t/m O). */
const COLUMN_POINTS: [number, number][] = [
  [5, 3], [3, 2], [3, 2], [3, 2], [2, 1], [2, 1], [2, 1], [1, 0],
  [2, 1], [2, 1], [2, 1], [3, 2], [3, 2], [3, 2], [5, 3],
];

/** Extra bladen met dezelfde regels en punten als blad 1, alleen een andere verdeling. */
function extraSheet(id: string, name: string, description: string, grid: string[]): Layout {
  return {
    id,
    name,
    description,
    grid,
    columnLabels: LABELS,
    startColumn: 7,
    columnPoints: COLUMN_POINTS,
    colorBonus: [5, 3],
    jokers: 8,
    starPenalty: 2,
  };
}

export const LAYOUTS: Layout[] = [
  {
    id: 'blad-1',
    name: 'Blad 1',
    description: 'Basisspel: start in kolom H.',
    grid: [
      'gggyyyyGbbbOyyy',
      'ogYgYyoorBboogg',
      'BgrgggGrrryyogg',
      'brrgoObbggyyoRb',
      'roooorbbooorrrr',
      'rBbRrrryYoRbbbO',
      'yybbbbryyyggGoo',
    ],
    columnLabels: LABELS,
    startColumn: 7,
    columnPoints: COLUMN_POINTS,
    colorBonus: [5, 3],
    jokers: 8,
    starPenalty: 2,
  },
  extraSheet('blad-geel', 'Geel blok', 'Extra scoreblok (level 2–4), gele achterkant.', [
    'rggYyyyorrgggbY',
    'rgrrryyorrggbbb',
    'bRrbbGggggRbOBr',
    'oooobbbBgYybrrr',
    'ybboorrrbbbRroo',
    'yyBggoOyyobyyyo',
    'GyygGooyOoooygg',
  ]),
  extraSheet('blad-paars', 'Paars blok', 'Extra scoreblok (level 2–4), paarse achterkant.', [
    'yyOooGbbbyyrrgg',
    'obbbrrrRryYbrRo',
    'oobbYrOooBbbrbB',
    'oGyyyyogobbObbr',
    'gggRyoggYooooor',
    'Bgrggogygrryyyr',
    'rrrgbbyyggggGyy',
  ]),
  extraSheet('blad-oranje', 'Oranje blok', 'Extra scoreblok (level 2–4), oranje achterkant.', [
    'OoYorrRgoRggggg',
    'boooGrggYrrGbyy',
    'ybbggrgyyyrrbyO',
    'yYbyyyyBbyyrooo',
    'rygBbGyobbbbobb',
    'gggrbbboggOyyBb',
    'grrrooorroooRrr',
  ]),
];

export function colorsFor(layout: Layout): Record<ColorKey, ColorInfo> {
  return { ...DEFAULT_COLORS, ...layout.colors };
}

/** Controleert een blad en geeft een lijst met problemen terug (leeg = in orde). */
export function validateLayout(layout: Layout): string[] {
  const problems: string[] = [];
  const width = layout.grid[0]?.length ?? 0;
  layout.grid.forEach((row, i) => {
    if (row.length !== width) problems.push(`Rij ${i + 1} heeft ${row.length} vakjes i.p.v. ${width}`);
    for (const ch of row) {
      if (!COLOR_ORDER.includes(ch.toLowerCase() as ColorKey)) problems.push(`Onbekend teken "${ch}" in rij ${i + 1}`);
    }
  });
  if (layout.columnPoints.length !== width) problems.push(`columnPoints heeft ${layout.columnPoints.length} kolommen i.p.v. ${width}`);
  if (layout.columnLabels.length < width) problems.push('Te weinig columnLabels');
  return problems;
}
