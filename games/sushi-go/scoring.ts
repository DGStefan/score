/**
 * Puntentelling Sushi Go! (origineel).
 * Pure functies, zodat ze los te testen zijn.
 */

export const CARD_KEYS = [
  'maki',
  'tempura',
  'sashimi',
  'gyoza',
  'egg',
  'salmon',
  'squid',
  'eggWasabi',
  'salmonWasabi',
  'squidWasabi',
] as const;

export type CardKey = (typeof CARD_KEYS)[number];

/** Wat één speler in één ronde voor zich heeft liggen. Maki = aantal rolletjes-iconen. */
export type Cards = Record<CardKey, number>;

export function emptyCards(): Cards {
  return Object.fromEntries(CARD_KEYS.map((k) => [k, 0])) as Cards;
}

export const GYOZA_POINTS = [0, 1, 3, 6, 10, 15] as const;

export interface RoundBreakdown {
  maki: number;
  tempura: number;
  sashimi: number;
  gyoza: number;
  nigiri: number;
  total: number;
}

/** Verdeel `points` over gelijk geëindigde spelers, naar beneden afgerond. */
function split(points: number, count: number): number {
  return count > 0 ? Math.floor(points / count) : 0;
}

/**
 * Maki: meeste rolletjes 6 punten, tweede meeste 3 punten.
 * Gelijkspel om de eerste plaats: 6 verdelen, geen tweede plaats.
 * Gelijkspel om de tweede plaats: 3 verdelen. Wie geen maki heeft, krijgt niets.
 */
export function makiPoints(makiCounts: number[]): number[] {
  const values = [...new Set(makiCounts.filter((n) => n > 0))].sort((a, b) => b - a);
  const result = makiCounts.map(() => 0);
  const most = values[0];
  if (most === undefined) return result;
  const firsts = makiCounts.flatMap((n, i) => (n === most ? [i] : []));
  for (const i of firsts) result[i] = split(6, firsts.length);
  if (firsts.length > 1) return result;
  const second = values[1];
  if (second === undefined) return result;
  const seconds = makiCounts.flatMap((n, i) => (n === second ? [i] : []));
  for (const i of seconds) result[i] = split(3, seconds.length);
  return result;
}

/** Punten van één speler; maki komt van buitenaf (hangt af van de anderen). */
export function cardPoints(c: Cards, maki: number): RoundBreakdown {
  const tempura = Math.floor(c.tempura / 2) * 5;
  const sashimi = Math.floor(c.sashimi / 3) * 10;
  const gyoza = GYOZA_POINTS[Math.min(c.gyoza, 5)] ?? 15;
  const nigiri = c.egg + c.salmon * 2 + c.squid * 3 + (c.eggWasabi + c.salmonWasabi * 2 + c.squidWasabi * 3) * 3;
  return { maki, tempura, sashimi, gyoza, nigiri, total: maki + tempura + sashimi + gyoza + nigiri };
}

/** Alle spelers tegelijk (als je ooit alles op één scherm wilt bijhouden). */
export function roundScores(cards: Cards[]): RoundBreakdown[] {
  const maki = makiPoints(cards.map((c) => c.maki));
  return cards.map((c, i) => cardPoints(c, maki[i] ?? 0));
}

/** Mogelijke maki-punten: 6 of 3, of een gedeeld deel daarvan (afgerond naar beneden). */
export const MAKI_CHOICES = [0, 1, 2, 3, 6] as const;

/** Mogelijke pudding-punten: ±6, of gedeeld. */
export const PUDDING_CHOICES = [-6, -3, -2, -1, 0, 1, 2, 3, 6] as const;

/**
 * Pudding (na ronde 3): meeste pudding +6, minste pudding −6, verdeeld bij gelijkspel.
 * Bij 2 spelers krijgt niemand minpunten. Heeft iedereen evenveel, dan krijgt niemand iets.
 */
export function puddingPoints(puddings: number[]): number[] {
  const result = puddings.map(() => 0);
  if (puddings.length === 0) return result;
  const max = Math.max(...puddings);
  const min = Math.min(...puddings);
  if (max === min) return result;
  const most = puddings.flatMap((n, i) => (n === max ? [i] : []));
  for (const i of most) result[i] = split(6, most.length);
  if (puddings.length > 2) {
    const least = puddings.flatMap((n, i) => (n === min ? [i] : []));
    for (const i of least) result[i] = -split(6, least.length);
  }
  return result;
}

/** Hints voor onvolledige sets: "nog 1 tempura voor 5 punten". */
export function openSets(c: Cards): string[] {
  const hints: string[] = [];
  if (c.tempura % 2 === 1) hints.push('1 tempura zonder partner');
  if (c.sashimi % 3 !== 0) hints.push(`${c.sashimi % 3} sashimi telt nog niet`);
  return hints;
}
