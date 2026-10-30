/**
 * Bergen (bladen) voor Trek 12. Elke berg is pure data: de plek van de 19 rondjes,
 * welke rondjes gevaarlijk terrein zijn, de bonustabel en de topscore.
 *
 * Coördinaten in het viewBox-stelsel van de kaart (1000 × 620).
 * Twee rondjes grenzen aan elkaar als hun middelpunten dichter dan ~2,15 × de straal liggen.
 */

export interface Spot {
  x: number;
  y: number;
  /** Gevaarlijk terrein (dikke rand): alleen 0–6. */
  danger?: boolean;
}

export interface Mountain {
  id: string;
  name: string;
  /** Moeilijkheid in sterren, zoals op de doos. */
  difficulty: number;
  /** Punten voor de "top bereikt"-ster. */
  summit: number;
  /** Straal van de rondjes in kaarteenheden. */
  radius: number;
  spots: Spot[];
  /** Bonus voor langste lijn / grootste zone; index = aantal rondjes. */
  bonus: number[];
  /** Extra bonus per rondje boven het laatste getal in de tabel. */
  bonusExtra: number;
  available: boolean;
}

/** Dunai: overgenomen van het blad (19 rondjes, geen gevaarlijk terrein). */
const DUNAI_SPOTS: Spot[] = [
  [420, 178], [304, 210], [660, 298], [334, 324], [450, 348], [568, 372], [250, 414],
  [366, 438], [792, 418], [910, 430], [486, 464], [1022, 478], [602, 490], [720, 514],
  [288, 528], [406, 552], [838, 526], [522, 578], [640, 604],
].map(([x, y]) => ({ x: (x as number) - 135, y: (y as number) - 75 }));

export const MOUNTAINS: Mountain[] = [
  {
    id: 'dunai',
    name: 'Dunai',
    difficulty: 3,
    summit: 65,
    radius: 58,
    spots: DUNAI_SPOTS,
    bonus: [0, 0, 0, 1, 3, 6, 10, 15, 20, 25],
    bonusExtra: 5,
    available: true,
  },
  {
    id: 'kagkot',
    name: 'Kagkot',
    difficulty: 6,
    summit: 0,
    radius: 58,
    spots: [],
    bonus: [],
    bonusExtra: 5,
    available: false,
  },
  {
    id: 'dhaulagiri',
    name: 'Dhaulagiri',
    difficulty: 9,
    summit: 0,
    radius: 58,
    spots: [],
    bonus: [],
    bonusExtra: 5,
    available: false,
  },
];

export function mountainById(id: string): Mountain | undefined {
  return MOUNTAINS.find((m) => m.id === id);
}

/** Buren per rondje, berekend uit de afstanden. */
export function neighbours(m: Mountain): number[][] {
  const limit = m.radius * 2.15;
  return m.spots.map((a, i) =>
    m.spots.flatMap((b, j) => (i !== j && Math.hypot(a.x - b.x, a.y - b.y) < limit ? [j] : [])),
  );
}
