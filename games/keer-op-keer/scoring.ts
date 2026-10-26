import { COLOR_ORDER, type ColorKey, type Layout } from './layouts';

/** Stand van één Keer op Keer-blad. Alleen wat de speler zelf aanvinkt. */
export interface SheetMarks {
  /** Per vakje (rij * breedte + kolom): afgekruist? */
  crossed: boolean[];
  /** Per kolom: heeft een andere speler deze kolom al eerder vol? */
  columnTaken: boolean[];
  /** Per kleur: heeft een andere speler deze kleur al eerder vol? */
  colorTaken: Record<ColorKey, boolean>;
  jokersUsed: number;
}

export interface Cell {
  index: number;
  row: number;
  col: number;
  color: ColorKey;
  star: boolean;
}

export interface Score {
  colors: number;
  columns: number;
  jokers: number;
  stars: number; // negatief
  total: number;
  completeColors: ColorKey[];
  completeColumns: number[];
}

export function width(layout: Layout): number {
  return layout.grid[0]?.length ?? 0;
}

export function cellsOf(layout: Layout): Cell[] {
  const w = width(layout);
  return layout.grid.flatMap((line, row) =>
    [...line].map((ch, col) => ({
      index: row * w + col,
      row,
      col,
      color: ch.toLowerCase() as ColorKey,
      star: ch !== ch.toLowerCase(),
    })),
  );
}

export function emptyMarks(layout: Layout): SheetMarks {
  return {
    crossed: cellsOf(layout).map(() => false),
    columnTaken: layout.columnPoints.map(() => false),
    colorTaken: { g: false, y: false, b: false, r: false, o: false },
    jokersUsed: 0,
  };
}

export function colorProgress(layout: Layout, marks: SheetMarks): Record<ColorKey, { done: number; total: number }> {
  const result = Object.fromEntries(COLOR_ORDER.map((c) => [c, { done: 0, total: 0 }])) as Record<
    ColorKey,
    { done: number; total: number }
  >;
  for (const cell of cellsOf(layout)) {
    result[cell.color].total++;
    if (marks.crossed[cell.index]) result[cell.color].done++;
  }
  return result;
}

/**
 * Spelregel: een vakje mag je afkruisen als het in de startkolom (H) ligt,
 * of recht naast een al afgekruist vakje (boven, onder, links of rechts; niet schuin).
 */
export function canCross(layout: Layout, marks: SheetMarks, cell: Cell): boolean {
  if (cell.col === layout.startColumn) return true;
  const w = width(layout);
  const rows = layout.grid.length;
  const neighbours: [number, number][] = [
    [cell.row - 1, cell.col],
    [cell.row + 1, cell.col],
    [cell.row, cell.col - 1],
    [cell.row, cell.col + 1],
  ];
  return neighbours.some(
    ([r, c]) => r >= 0 && r < rows && c >= 0 && c < w && Boolean(marks.crossed[r * w + c]),
  );
}

export function isColumnComplete(layout: Layout, marks: SheetMarks, col: number): boolean {
  const w = width(layout);
  return layout.grid.every((_, row) => marks.crossed[row * w + col]);
}

/**
 * Puntentelling:
 *  + kolom vol: eerste-punten, of later-punten als een ander hem eerder vol had
 *  + kleur vol: idem met de kleurbonus
 *  + elke ongebruikte joker 1 punt
 *  − elke niet-afgekruiste ster
 */
export function score(layout: Layout, marks: SheetMarks): Score {
  const completeColumns = layout.columnPoints
    .map((_, col) => col)
    .filter((col) => isColumnComplete(layout, marks, col));
  const columns = completeColumns.reduce((sum, col) => {
    const [first, later] = layout.columnPoints[col] ?? [0, 0];
    return sum + (marks.columnTaken[col] ? later : first);
  }, 0);

  const progress = colorProgress(layout, marks);
  const completeColors = COLOR_ORDER.filter((c) => progress[c].total > 0 && progress[c].done === progress[c].total);
  const colors = completeColors.reduce(
    (sum, c) => sum + (marks.colorTaken[c] ? layout.colorBonus[1] : layout.colorBonus[0]),
    0,
  );

  const jokers = Math.max(0, layout.jokers - marks.jokersUsed);
  const openStars = cellsOf(layout).filter((cell) => cell.star && !marks.crossed[cell.index]).length;
  const stars = -openStars * layout.starPenalty;

  return { colors, columns, jokers, stars, total: colors + columns + jokers + stars, completeColors, completeColumns };
}
