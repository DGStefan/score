import {
  APPLES,
  BEAN_HEIGHT,
  BEAN_NEEDS_CORN,
  BEAN_POINTS,
  BLACKBERRIES,
  COMPOST_MAX,
  COMPOST_START,
  CORN_HEIGHT,
  CORN_POINTS,
  FLOWER_NAMES,
  FRUIT_BOWL_POINTS,
  FRUIT_TRACKS,
  GOODS_MAX,
  GOODS_STAR_EVERY,
  HIVE,
  HONEY,
  MARKET,
  PEACHES,
  PERENNIALS,
  PUMPKINS,
  RASPBERRIES,
  SHED,
  SPLIT,
  TULIP_MAX,
  UNITS,
  WAX,
  type ActionKind,
  type Effect,
  type FlowerId,
  type ShedId,
  type Track,
} from './data';

/* ------------------------------------------------------------------ */
/* Stand                                                               */
/* ------------------------------------------------------------------ */

export interface Job {
  id: number;
  kind: ActionKind;
  source: string;
}

export interface Sheet {
  corn: number[];
  bean: number[];
  pumpkin: number[];
  per: Record<FlowerId, number>;
  tracks: Record<string, number>;
  shed: Record<ShedId, number>;
  goods: number;
  compost: number;
  compostSpent: number;
  journal: Job[];
  nextJob: number;
  round: number;
}

export function emptySheet(): Sheet {
  return {
    corn: UNITS.map(() => 0),
    bean: UNITS.map(() => 0),
    pumpkin: PUMPKINS.map(() => 0),
    per: { tulip: 0, hydrangea: 0, iris: 0, hyacinth: 0, crocus: 0, daffodil: 0 },
    tracks: { hive: 0, wax: 0, honey: 0, split: 0, apple: 0, peach: 0, blackberry: 0, raspberry: 0 },
    shed: Object.fromEntries(SHED.map((s) => [s.id, 0])) as Record<ShedId, number>,
    goods: 0,
    compost: COMPOST_START,
    compostSpent: 0,
    journal: [],
    nextJob: 1,
    round: 1,
  };
}

export const TRACKS: Record<string, Track> = {
  hive: HIVE,
  wax: WAX,
  honey: HONEY,
  split: SPLIT,
  apple: APPLES,
  peach: PEACHES,
  blackberry: BLACKBERRIES,
  raspberry: RASPBERRIES,
};

export const ACTION_LABEL: Record<ActionKind, string> = {
  fruit: 'Fruitactie (rij naar keuze)',
  apple: 'Appel',
  peach: 'Perzik',
  blackberry: 'Braam',
  raspberry: 'Framboos',
  shed: 'Schuuractie',
  perennial: 'Vaste plant naar keuze',
  apiary: 'Bijenstal',
  bonus: '⭐ Bonusactie (vaste plant, bijen, fruit of schuur)',
  water: 'Water geven in een zone naar keuze',
  plant: 'Planten in een zone naar keuze',
  plantwater: 'Planten of water geven in een zone naar keuze',
  tulip: 'Tulp',
  hydrangea: 'Hortensia',
  iris: 'Iris',
  hyacinth: 'Hyacint',
  crocus: 'Krokus',
  daffodil: 'Narcis',
};

/* ------------------------------------------------------------------ */
/* Acties: werken op een kopie en verzamelen meldingen                 */
/* ------------------------------------------------------------------ */

export interface Result {
  sheet: Sheet;
  messages: string[];
  error?: string;
}

class Draft {
  s: Sheet;
  messages: string[] = [];
  constructor(s: Sheet) {
    this.s = structuredClone(s);
  }

  job(kind: ActionKind, source: string, count = 1): void {
    for (let i = 0; i < count; i++) this.s.journal.push({ id: this.s.nextJob++, kind, source });
  }

  goods(n: number, source: string): void {
    if (n <= 0) return;
    const old = this.s.goods;
    this.s.goods = Math.min(GOODS_MAX, old + n);
    const stars = Math.floor(this.s.goods / GOODS_STAR_EVERY) - Math.floor(old / GOODS_STAR_EVERY);
    this.messages.push(`+${n} 📦 (${source})`);
    if (stars > 0) {
      this.job('bonus', 'ster op goederen', stars);
      this.messages.push(`⭐ ${stars === 1 ? 'Bonusactie' : `${stars} bonusacties`}!`);
    }
  }

  compost(n: number, source: string): void {
    if (n <= 0) return;
    this.s.compost = Math.min(COMPOST_MAX, this.s.compost + n);
    this.messages.push(`+${n} compost (${source})`);
  }

  effect(e: Effect | undefined, source: string): void {
    if (!e) return;
    if (e.goods) this.goods(e.goods, source);
    if (e.compost) this.compost(e.compost, source);
    for (const a of e.actions ?? []) {
      this.job(a.kind, source, a.count ?? 1);
      this.messages.push(`📓 ${a.count && a.count > 1 ? `${a.count}× ` : ''}${ACTION_LABEL[a.kind]}`);
    }
  }

  done(): Result {
    return { sheet: this.s, messages: this.messages };
  }
}

const fail = (s: Sheet, error: string): Result => ({ sheet: s, messages: [], error });
const shedDone = (s: Sheet, id: ShedId): boolean => s.shed[id] >= (SHED.find((x) => x.id === id)?.boxes ?? 99);

/* ---------- Tuin ---------- */

export function growCorn(s: Sheet, i: number): Result {
  if ((s.corn[i] ?? 0) >= CORN_HEIGHT) return fail(s, 'Deze mais is al geoogst');
  const d = new Draft(s);
  d.s.corn[i] = (d.s.corn[i] ?? 0) + 1;
  if (d.s.corn[i] === CORN_HEIGHT) d.messages.push(`🌽 Mais geoogst (${CORN_POINTS} pt)`);
  return d.done();
}

export function growBean(s: Sheet, i: number): Result {
  const b = s.bean[i] ?? 0;
  if (b >= BEAN_HEIGHT) return fail(s, 'Deze boon is al geoogst');
  if (b === 0 && (s.corn[i] ?? 0) < BEAN_NEEDS_CORN) return fail(s, `Een boon mag pas als de mais ernaast ${BEAN_NEEDS_CORN} hoog is`);
  const d = new Draft(s);
  d.s.bean[i] = b + 1;
  if (d.s.bean[i] === BEAN_HEIGHT) d.messages.push(`🫘 Boon geoogst (${BEAN_POINTS} pt)`);
  return d.done();
}

function pumpkinStep(d: Draft, i: number): void {
  const p = PUMPKINS[i];
  if (!p) return;
  d.s.pumpkin[i] = (d.s.pumpkin[i] ?? 0) + 1;
  if (d.s.pumpkin[i] !== p.height) return;
  d.messages.push('🎃 Pompoen geoogst');
  d.goods(p.goods, 'pompoen');
  const n = PUMPKINS.length;
  const prev = (i - 1 + n) % n;
  const next = (i + 1) % n;
  const done = (k: number): boolean => (d.s.pumpkin[k] ?? 0) >= (PUMPKINS[k]?.height ?? 99);
  if (done(prev)) {
    const f = PUMPKINS[prev]?.between;
    if (f) {
      d.job(f, 'twee pompoenen naast elkaar');
      d.messages.push(`📓 ${FLOWER_NAMES[f]} (pompoenen naast elkaar)`);
    }
  }
  if (done(next) && next !== prev) {
    d.job(p.between, 'twee pompoenen naast elkaar');
    d.messages.push(`📓 ${FLOWER_NAMES[p.between]} (pompoenen naast elkaar)`);
  }
}

export function growPumpkin(s: Sheet, i: number): Result {
  const p = PUMPKINS[i];
  if (!p || (s.pumpkin[i] ?? 0) >= p.height) return fail(s, 'Deze pompoen is al geoogst');
  const d = new Draft(s);
  pumpkinStep(d, i);
  return d.done();
}

/** Water: elk al geplant gewas in de zone één vakje verder. */
export function waterZone(s: Sheet, zone: number): Result {
  const d = new Draft(s);
  let grown = 0;
  UNITS.forEach((u, i) => {
    if (u.zone !== zone) return;
    const c = d.s.corn[i] ?? 0;
    if (c > 0 && c < CORN_HEIGHT) {
      d.s.corn[i] = c + 1;
      grown++;
      if (c + 1 === CORN_HEIGHT) d.messages.push('🌽 Mais geoogst');
    }
    const b = d.s.bean[i] ?? 0;
    if (b > 0 && b < BEAN_HEIGHT) {
      d.s.bean[i] = b + 1;
      grown++;
      if (b + 1 === BEAN_HEIGHT) d.messages.push('🫘 Boon geoogst');
    }
  });
  PUMPKINS.forEach((p, i) => {
    const v = d.s.pumpkin[i] ?? 0;
    if (p.zone === zone && v > 0 && v < p.height) {
      pumpkinStep(d, i);
      grown++;
    }
  });
  if (grown === 0) d.messages.push(`Zone ${zone}: niets geplant om water te geven`);
  else d.messages.unshift(`💧 Zone ${zone}: ${grown} gewas${grown === 1 ? '' : 'sen'} gegroeid`);
  return d.done();
}

export function rain(s: Sheet): Result {
  let cur = s;
  const messages: string[] = ['🌧️ Regen: water in alle zones'];
  for (let z = 1; z <= 6; z++) {
    const r = waterZone(cur, z);
    cur = r.sheet;
    messages.push(...r.messages.filter((m) => !m.includes('niets geplant')));
  }
  const d = new Draft(cur);
  if (shedDone(cur, 'barrel')) {
    d.job('water', 'regenton');
    messages.push('📓 Regenton: water 1 zone naar keuze');
  }
  return { sheet: d.s, messages };
}

/* ---------- Vaste planten ---------- */

export function growPerennial(s: Sheet, f: FlowerId): Result {
  const per = PERENNIALS.find((p) => p.id === f);
  const idx = s.per[f];
  if (!per || idx >= per.steps.length) return fail(s, `${FLOWER_NAMES[f]} is al vol`);
  const d = new Draft(s);
  d.s.per[f] = idx + 1;
  const step = per.steps[idx];
  d.effect(step, FLOWER_NAMES[f]);
  if (step?.note) d.messages.push(`🌼 ${step.note}`);
  if (f === 'crocus' && shedDone(s, 'hivetool')) {
    d.job('apiary', 'bijenbeitel');
    d.messages.push('📓 Bijenbeitel: bijenstal-actie');
  }
  if (f === 'hydrangea' && shedDone(s, 'pitchfork')) d.compost(1, 'hooivork');
  if (d.s.per[f] === per.steps.length) d.messages.push(`🌸 ${FLOWER_NAMES[f]} vol!`);
  return d.done();
}

/* ---------- Bijenstal en fruit ---------- */

const isRound = (t: Track, idx: number): boolean => Boolean(t.cells[idx]?.round);

export function growTrack(s: Sheet, id: string): Result {
  const t = TRACKS[id];
  if (!t) return fail(s, 'Onbekend');
  const idx = s.tracks[id] ?? 0;
  if (idx >= t.cells.length) return fail(s, `${t.name}: al vol`);
  if (['wax', 'honey', 'split'].includes(id) && (s.tracks.hive ?? 0) < HIVE.cells.length)
    return fail(s, 'Eerst de bijenkast vol maken; daarna kies je was, honing of splitsen');
  const d = new Draft(s);
  d.s.tracks[id] = idx + 1;
  const cell = t.cells[idx];
  d.effect(cell?.effect, t.name);
  if (isRound(t, idx)) {
    if (id === 'apple') {
      d.messages.push('🍎 Appel geoogst');
      if (shedDone(s, 'pie')) d.goods(1, 'taartkast');
    }
    if (id === 'peach') {
      d.messages.push('🍑 Perzik geoogst');
      const tulip = (s.per.tulip >= 2 ? 2 : 0) + (s.per.tulip >= 4 ? 1 : 0);
      if (tulip) d.goods(tulip, 'tulp');
      if (shedDone(s, 'pie')) d.goods(1, 'taartkast');
    }
    if (id === 'blackberry') {
      d.messages.push('🫐 Braam geoogst');
      if (shedDone(s, 'jars')) d.goods(1, 'weckpotten');
    }
    if (id === 'raspberry') d.messages.push('🍓 Framboos geoogst');
  }
  if (id === 'hive' && d.s.tracks.hive === HIVE.cells.length) d.messages.push('🐝 Bijenkast vol: was, honing en splitsen zijn open');
  return d.done();
}

/* ---------- Schuur ---------- */

export function growShed(s: Sheet, id: ShedId): Result {
  const item = SHED.find((x) => x.id === id);
  if (!item || s.shed[id] >= item.boxes) return fail(s, `${item?.name ?? 'Dit'} is al af`);
  const d = new Draft(s);
  if (shedDone(s, 'wheelbarrow')) d.goods(1, 'kruiwagen');
  d.s.shed[id] = s.shed[id] + 1;
  if (d.s.shed[id] === item.boxes) d.messages.push(`🧰 ${item.name} af${item.text ? `: ${item.text}` : ''}`);
  return d.done();
}

/* ---------- Goederen, compost, markt ---------- */

export function addGoods(s: Sheet, n: number, source = 'handmatig'): Result {
  if (n < 0) {
    const d = new Draft(s);
    d.s.goods = Math.max(0, s.goods + n);
    return d.done();
  }
  const d = new Draft(s);
  d.goods(n, source);
  return d.done();
}

export function addCompost(s: Sheet, n: number): Result {
  const d = new Draft(s);
  if (n >= 0) d.compost(n, 'handmatig');
  else d.s.compost = Math.max(d.s.compostSpent, s.compost + n);
  return d.done();
}

export function compostLeft(s: Sheet): number {
  return s.compost - s.compostSpent;
}

export function spendCompost(s: Sheet, n = 1): Result {
  if (compostLeft(s) < n) return fail(s, 'Niet genoeg compost');
  const d = new Draft(s);
  d.s.compostSpent += n;
  d.messages.push(`−${n} compost (steen ±${n})`);
  return d.done();
}

export function useShovel(s: Sheet): Result {
  if (!shedDone(s, 'shovel')) return fail(s, 'De schep is nog niet af');
  if (compostLeft(s) < 3) return fail(s, 'Je hebt 3 compost nodig');
  const d = new Draft(s);
  d.s.compostSpent += 3;
  d.job('bonus', 'schep');
  d.messages.push('📓 Schep: 3 compost → ⭐ bonusactie');
  return d.done();
}

/** Rondel: 1 compost en 4 goederen. */
export function compostAndGoods(s: Sheet): Result {
  const d = new Draft(s);
  d.compost(1, 'rondel');
  d.goods(4, 'rondel');
  return d.done();
}

export function marketRow(goods: number): (typeof MARKET)[number] {
  return MARKET.find((m) => goods >= m.from) ?? (MARKET[MARKET.length - 1] as (typeof MARKET)[number]);
}

export function market(s: Sheet): Result {
  const row = marketRow(s.goods);
  const d = new Draft(s);
  d.messages.push(`🧺 Markt (${s.goods} goederen → rij ${row.from}+)`);
  if (row.compost) d.compost(row.compost, 'markt');
  d.effect({ actions: row.actions }, 'markt');
  if (shedDone(s, 'labels')) {
    d.job('perennial', 'etiketten');
    d.messages.push('📓 Etiketten: +1 vaste plant');
  }
  return d.done();
}

/* ---------- Journaal ---------- */

export function resolveJob(s: Sheet, id: number): Sheet {
  return { ...s, journal: s.journal.filter((j) => j.id !== id) };
}

/** Taken die je met één tik kunt uitvoeren (vaste plant X, appel, ...). */
export function jobTarget(kind: ActionKind): ((s: Sheet) => Result) | null {
  if (['tulip', 'hydrangea', 'iris', 'hyacinth', 'crocus', 'daffodil'].includes(kind)) return (s) => growPerennial(s, kind as FlowerId);
  if (['apple', 'peach', 'blackberry', 'raspberry'].includes(kind)) return (s) => growTrack(s, kind);
  return null;
}

/* ------------------------------------------------------------------ */
/* Telling                                                             */
/* ------------------------------------------------------------------ */

function harvested(t: Track, filled: number): number {
  return t.cells.slice(0, filled).filter((c) => c.round).length;
}

function trackPoints(t: Track, filled: number): number {
  return t.cells.slice(0, filled).reduce((sum, c) => sum + (c.points ?? 0), 0);
}

export function longestPumpkinChain(s: Sheet): number {
  const n = PUMPKINS.length;
  const done = PUMPKINS.map((p, i) => (s.pumpkin[i] ?? 0) >= p.height);
  if (done.every(Boolean)) return n;
  let best = 0;
  let run = 0;
  for (let k = 0; k < n * 2; k++) {
    run = done[k % n] ? run + 1 : 0;
    best = Math.max(best, Math.min(run, n));
  }
  return best;
}

export interface Score {
  garden: number;
  perennials: number;
  apiary: number;
  fruit: number;
  shed: number;
  total: number;
  cornHarvested: number;
  beansHarvested: number;
  fruitHarvested: number;
}

export function score(s: Sheet): Score {
  const cornHarvested = s.corn.filter((c) => c >= CORN_HEIGHT).length;
  const beansHarvested = s.bean.filter((b) => b >= BEAN_HEIGHT).length;
  const garden = cornHarvested * CORN_POINTS + beansHarvested * BEAN_POINTS;

  const fruitCounts = FRUIT_TRACKS.map((t) => harvested(t, s.tracks[t.id] ?? 0));
  const fruitHarvested = fruitCounts.reduce((a, b) => a + b, 0);

  const perennials = PERENNIALS.reduce((sum, p) => {
    if (s.per[p.id] < p.steps.length) return sum;
    return sum + (p.id === 'tulip' ? Math.min(TULIP_MAX, fruitHarvested) : p.points);
  }, 0);

  const apiary = trackPoints(WAX, s.tracks.wax ?? 0) + trackPoints(HONEY, s.tracks.honey ?? 0) + trackPoints(SPLIT, s.tracks.split ?? 0);
  const fruit =
    trackPoints(APPLES, s.tracks.apple ?? 0) + trackPoints(BLACKBERRIES, s.tracks.blackberry ?? 0) + trackPoints(RASPBERRIES, s.tracks.raspberry ?? 0);

  const shed = SHED.reduce((sum, item) => {
    if (s.shed[item.id] < item.boxes) return sum;
    if (item.id === 'bowl') return sum + (FRUIT_BOWL_POINTS[fruitCounts.filter((c) => c > 0).length] ?? 0);
    if (item.id === 'casserole') return sum + Math.floor(beansHarvested / 2);
    if (item.id === 'carving') return sum + longestPumpkinChain(s);
    return sum + item.points;
  }, 0);

  return {
    garden,
    perennials,
    apiary,
    fruit,
    shed,
    total: garden + perennials + apiary + fruit + shed,
    cornHarvested,
    beansHarvested,
    fruitHarvested,
  };
}
