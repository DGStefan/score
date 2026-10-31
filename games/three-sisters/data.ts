/**
 * Three Sisters: alle vakjes van het blad als "sporen" die je van begin tot eind invult,
 * met per vakje het effect. Posities zijn pixels op de eigen tekeningen
 * (tuin 1082 × 1453, erf 1079 × 1458) en worden in de app omgerekend naar procenten.
 */

export const TUIN_W = 1082;
export const TUIN_H = 1453;
export const ERF_W = 1079;
export const ERF_H = 1458;

/* ------------------------------------------------------------------ */
/* Acties en effecten                                                  */
/* ------------------------------------------------------------------ */

export type ActionKind =
  | 'fruit' // vul een vakje in een fruitrij naar keuze
  | 'apple'
  | 'peach'
  | 'blackberry'
  | 'raspberry'
  | 'shed'
  | 'perennial'
  | 'apiary'
  | 'bonus' // ster: vaste plant, bijenstal, fruit of schuur
  | 'water' // water geven in een zone naar keuze
  | 'plant' // planten in een zone naar keuze
  | 'plantwater'
  | 'garden' // planten of water geven in de zone van de steen (zie bron)
  | 'apiaryfruit' // bijenstal óf fruit
  | FlowerId; // vaste plant van deze soort

export interface Effect {
  goods?: number;
  compost?: number;
  actions?: { kind: ActionKind; count?: number }[];
  /** Doorlopende bonus, alleen als uitleg. */
  note?: string;
}

/* ------------------------------------------------------------------ */
/* Tuin                                                                */
/* ------------------------------------------------------------------ */

export const CORN_HEIGHT = 4;
export const BEAN_HEIGHT = 2;
/** Een boon mag pas geplant worden als de mais ernaast minstens zo hoog is. */
export const BEAN_NEEDS_CORN = 2;
export const CORN_POINTS = 3;
export const BEAN_POINTS = 1;

/** Een perkje: één maisplant met één boon ernaast. [x, y, w, h] op de tuintekening. */
export interface Unit {
  zone: number;
  rect: [number, number, number, number];
}

const wide = (zone: number, x: number, y: number): Unit[] => [
  { zone, rect: [x, y, 120, 112] },
  { zone, rect: [x + 120, y, 120, 112] },
];

export const UNITS: Unit[] = [
  // zone 1: drie perkjes onder elkaar
  { zone: 1, rect: [178, 195, 105, 112] },
  { zone: 1, rect: [178, 330, 105, 112] },
  { zone: 1, rect: [178, 470, 105, 112] },
  // zone 2: 2×2 breed + één klein
  ...wide(2, 333, 192),
  ...wide(2, 333, 327),
  { zone: 2, rect: [328, 468, 110, 112] },
  // zone 3: 2×2 breed
  ...wide(3, 630, 192),
  ...wide(3, 630, 327),
  // zone 4: drie kleine onder elkaar
  { zone: 4, rect: [793, 497, 105, 112] },
  { zone: 4, rect: [793, 637, 105, 112] },
  { zone: 4, rect: [793, 777, 105, 112] },
  // zone 5: één klein + 2×2 breed
  { zone: 5, rect: [618, 497, 115, 112] },
  ...wide(5, 490, 637),
  ...wide(5, 490, 777),
  // zone 6: 2×2 breed
  ...wide(6, 180, 637),
  ...wide(6, 180, 777),
];

/** Plek van het zonenummer (tik = zone-paneel). */
export const ZONE_BADGES: Record<number, [number, number]> = {
  1: [92, 100],
  2: [334, 96],
  3: [996, 92],
  4: [832, 936],
  5: [622, 932],
  6: [339, 936],
};

export type FlowerId = 'tulip' | 'hydrangea' | 'iris' | 'hyacinth' | 'crocus' | 'daffodil';

export const FLOWER_NAMES: Record<FlowerId, string> = {
  tulip: 'Tulp',
  hydrangea: 'Hortensia',
  iris: 'Iris',
  hyacinth: 'Hyacint',
  crocus: 'Krokus',
  daffodil: 'Narcis',
};

export const FLOWER_COLORS: Record<FlowerId, string> = {
  tulip: '#e8505b',
  hydrangea: '#5b8fe0',
  iris: '#7d5bd0',
  hyacinth: '#c45bc0',
  crocus: '#9c8fe6',
  daffodil: '#f2c12e',
};

/**
 * Pompoenen rondom de tuin, in volgorde van de ring (met de klok mee vanaf zone 1 boven).
 * Tussen pompoen i en i+1 staat de bloem `between`: oogst je beide, dan krijg je die actie.
 */
export interface Pumpkin {
  zone: number;
  height: number;
  goods: number;
  pos: [number, number];
  between: FlowerId;
  /** Plek van het bloemlabel tussen deze en de volgende pompoen. */
  label: [number, number];
}

export const PUMPKINS: Pumpkin[] = [
  { zone: 1, height: 1, goods: 1, pos: [228, 120], between: 'iris', label: [424, 88] },
  { zone: 2, height: 4, goods: 3, pos: [535, 110], between: 'tulip', label: [673, 84] },
  { zone: 3, height: 2, goods: 1, pos: [800, 115], between: 'hyacinth', label: [875, 146] },
  { zone: 3, height: 3, goods: 2, pos: [1000, 245], between: 'iris', label: [1000, 376] },
  { zone: 4, height: 4, goods: 3, pos: [1000, 500], between: 'daffodil', label: [961, 704] },
  { zone: 4, height: 3, goods: 3, pos: [1000, 800], between: 'crocus', label: [953, 945] },
  { zone: 4, height: 1, goods: 1, pos: [855, 985], between: 'hydrangea', label: [712, 1018] },
  { zone: 5, height: 2, goods: 1, pos: [535, 965], between: 'tulip', label: [347, 1016] },
  { zone: 6, height: 4, goods: 3, pos: [235, 950], between: 'hyacinth', label: [89, 936] },
  { zone: 6, height: 3, goods: 2, pos: [80, 815], between: 'daffodil', label: [77, 698] },
  { zone: 1, height: 4, goods: 3, pos: [80, 455], between: 'crocus', label: [100, 318] },
  { zone: 1, height: 3, goods: 2, pos: [80, 245], between: 'hydrangea', label: [138, 152] },
];

/* ------------------------------------------------------------------ */
/* Vaste planten (6 vakjes, van onder naar boven)                      */
/* ------------------------------------------------------------------ */

export interface Perennial {
  id: FlowerId;
  /** effecten per vakje, index 0 = onderste */
  steps: (Effect & { label?: string })[];
  points: number; // bij een volle kolom (tulp: zie score)
}

export const PERENNIALS: Perennial[] = [
  {
    id: 'tulip',
    points: 0,
    steps: [
      { actions: [{ kind: 'fruit' }], label: 'Fruit' },
      { note: 'Perzik oogsten: +2 goederen', label: '2📦 per perzik' },
      {},
      { note: 'Perzik oogsten: nog +1 goed (samen 3)', label: '3📦 per perzik' },
      {},
      { label: '1 pt per fruit' },
    ],
  },
  {
    id: 'hydrangea',
    points: 7,
    steps: [
      { actions: [{ kind: 'apple' }], label: 'Appel' },
      {},
      { actions: [{ kind: 'blackberry' }], label: 'Braam' },
      { actions: [{ kind: 'raspberry' }], label: 'Framboos' },
      { actions: [{ kind: 'peach' }], label: 'Perzik' },
      { label: '7 pt' },
    ],
  },
  {
    id: 'iris',
    points: 12,
    steps: [
      { compost: 1, label: '+1 compost' },
      { note: 'Planten/water: steen ±1', label: 'Plant/water ±1' },
      {},
      { note: 'Planten/water: steen ±2', label: 'Plant/water ±2' },
      {},
      { label: '12 pt' },
    ],
  },
  {
    id: 'hyacinth',
    points: 10,
    steps: [{ goods: 2, label: '+2 📦' }, { goods: 2, label: '+2 📦' }, {}, { goods: 2, label: '+2 📦' }, {}, { label: '10 pt' }],
  },
  {
    id: 'crocus',
    points: 6,
    steps: [
      { compost: 2, label: '+2 compost' },
      { compost: 1, label: '+1 compost' },
      { compost: 1, label: '+1 compost' },
      { compost: 2, label: '+2 compost' },
      {},
      { label: '6 pt' },
    ],
  },
  {
    id: 'daffodil',
    points: 4,
    steps: [
      { actions: [{ kind: 'shed' }], label: 'Schuur' },
      {},
      { actions: [{ kind: 'shed' }], label: 'Schuur' },
      { actions: [{ kind: 'shed' }], label: 'Schuur' },
      { actions: [{ kind: 'shed' }], label: 'Schuur' },
      { label: '4 pt' },
    ],
  },
];

export const TULIP_MAX = 15;

/** Vaste-plantenvak op de tuintekening (zandvlak onderaan). */
export const PERENNIAL_AREA: [number, number, number, number] = [40, 1065, 1002, 245];

/* ------------------------------------------------------------------ */
/* Bijenstal                                                           */
/* ------------------------------------------------------------------ */

export interface Track {
  id: string;
  name: string;
  /** Per vakje: harvest = rondje (oogst), plus effect en punten. */
  cells: { round?: boolean; effect?: Effect; points?: number; label?: string }[];
}

const sq = {};
const rnd = (extra: Partial<Track['cells'][number]> = {}): Track['cells'][number] => ({ round: true, ...extra });

export const HIVE: Track = {
  id: 'hive',
  name: 'Bijenkast',
  cells: [sq, rnd({ effect: { actions: [{ kind: 'fruit' }] }, label: 'Fruit' }), sq, rnd({ effect: { actions: [{ kind: 'fruit', count: 2 }] }, label: 'Fruit ×2' }), sq],
};

export const WAX: Track = {
  id: 'wax',
  name: 'Was',
  cells: [
    rnd({ effect: { goods: 2 }, points: 2, label: '+2📦 2pt' }),
    rnd({ effect: { goods: 4 }, points: 2, label: '+4📦 2pt' }),
    sq,
    rnd({ effect: { goods: 4 }, points: 5, label: '+4📦 5pt' }),
  ],
};

export const HONEY: Track = {
  id: 'honey',
  name: 'Honing',
  cells: [rnd({ points: 5, label: '5 pt' }), rnd({ points: 5, label: '5 pt' }), sq, rnd({ points: 8, label: '8 pt' })],
};

export const SPLIT: Track = {
  id: 'split',
  name: 'Splitsen',
  cells: [
    rnd({ points: 3, label: '3 pt' }),
    rnd({ effect: { actions: [{ kind: 'plant' }] }, label: 'Planten ⊕' }),
    rnd({ effect: { actions: [{ kind: 'fruit', count: 3 }] }, label: 'Fruit ×3' }),
    rnd({ effect: { actions: [{ kind: 'plantwater', count: 2 }] }, label: 'Plant/water ×2' }),
  ],
};

/* ------------------------------------------------------------------ */
/* Fruit (van links naar rechts)                                       */
/* ------------------------------------------------------------------ */

const pattern = (p: string, make: (i: number) => Track['cells'][number]): Track['cells'] =>
  [...p].map((ch, i) => (ch === 'o' ? make(i) : sq));

export const APPLES: Track = { id: 'apple', name: 'Appels', cells: pattern('xoxooooo', () => rnd({ points: 3 })) };
export const PEACHES: Track = {
  id: 'peach',
  name: 'Perziken',
  cells: pattern('xoxoxoxo', () => rnd({ effect: { actions: [{ kind: 'water' }] }, label: 'Water' })),
};
export const BLACKBERRIES: Track = { id: 'blackberry', name: 'Bramen', cells: pattern('ooooooo', () => rnd({ points: 2 })) };
export const RASPBERRIES: Track = {
  id: 'raspberry',
  name: 'Frambozen',
  cells: pattern('ooooooooo', (i) => rnd({ effect: { goods: 3 }, points: i === 2 ? 1 : i === 5 ? 2 : i === 8 ? 3 : 0 })),
};

export const FRUIT_TRACKS = [APPLES, PEACHES, BLACKBERRIES, RASPBERRIES];

/* ------------------------------------------------------------------ */
/* Schuur                                                              */
/* ------------------------------------------------------------------ */

export type ShedId =
  | 'jars'
  | 'pie'
  | 'shovel'
  | 'bowl'
  | 'barrel'
  | 'casserole'
  | 'labels'
  | 'hivetool'
  | 'pitchfork'
  | 'trimmer'
  | 'wheelbarrow'
  | 'mulch'
  | 'tractor'
  | 'carving'
  | 'seeder';

export interface ShedItem {
  id: ShedId;
  name: string;
  boxes: number;
  points: number;
  text: string;
  rect: [number, number, number, number];
}

export const SHED: ShedItem[] = [
  { id: 'jars', name: 'Weckpotten', boxes: 1, points: 1, text: '+1 📦 per braam', rect: [482, 38, 172, 205] },
  { id: 'pie', name: 'Taartkast', boxes: 2, points: 3, text: '+1 📦 per appel/perzik', rect: [666, 38, 196, 205] },
  { id: 'shovel', name: 'Schep', boxes: 2, points: 1, text: '3 compost → ⭐', rect: [872, 38, 182, 205] },
  { id: 'bowl', name: 'Fruitschaal', boxes: 3, points: 0, text: '1/4/7/10 pt per soort fruit', rect: [482, 250, 172, 145] },
  { id: 'barrel', name: 'Regenton', boxes: 2, points: 2, text: 'Na regen: water 1 zone', rect: [666, 250, 196, 145] },
  { id: 'casserole', name: 'Ovenschaal', boxes: 2, points: 0, text: '1 pt per 2 bonen', rect: [872, 250, 182, 145] },
  { id: 'labels', name: 'Etiketten', boxes: 3, points: 2, text: 'Markt: +1 vaste plant', rect: [482, 402, 172, 160] },
  { id: 'hivetool', name: 'Bijenbeitel', boxes: 3, points: 2, text: 'Bij krokus: +bijenstal', rect: [666, 402, 196, 160] },
  { id: 'pitchfork', name: 'Hooivork', boxes: 1, points: 1, text: 'Bij hortensia: +1 compost', rect: [872, 402, 182, 160] },
  { id: 'trimmer', name: 'Bosmaaier', boxes: 3, points: 6, text: '', rect: [482, 568, 172, 182] },
  { id: 'wheelbarrow', name: 'Kruiwagen', boxes: 2, points: 3, text: '+1 📦 na schuuractie', rect: [666, 568, 196, 182] },
  { id: 'mulch', name: 'Mulch', boxes: 1, points: 1, text: '2 vaste planten i.p.v. rondel', rect: [872, 568, 182, 182] },
  { id: 'tractor', name: 'Nieuwe tractor', boxes: 6, points: 18, text: '', rect: [458, 770, 200, 160] },
  { id: 'carving', name: 'Snijset', boxes: 3, points: 0, text: '1 pt per pompoen in langste rij', rect: [660, 770, 270, 160] },
  { id: 'seeder', name: 'Zaaier', boxes: 4, points: 2, text: 'Planten: tot 3 gewassen', rect: [932, 770, 135, 160] },
];

export const FRUIT_BOWL_POINTS = [0, 1, 4, 7, 10];

/* ------------------------------------------------------------------ */
/* Erf: posities                                                       */
/* ------------------------------------------------------------------ */

export const APIARY_AREA: [number, number, number, number] = [24, 30, 440, 420];
export const FRUIT_ROWS: Record<string, [number, number, number, number]> = {
  apple: [28, 585, 420, 64],
  peach: [28, 765, 420, 64],
  blackberry: [28, 905, 420, 64],
  raspberry: [28, 1048, 420, 64],
};
export const JOURNAL_AREA: [number, number, number, number] = [452, 940, 610, 228];
export const GOODS_AREA: [number, number, number, number] = [44, 1230, 650, 200];
export const COMPOST_AREA: [number, number, number, number] = [740, 1205, 300, 225];

export const GOODS_MAX = 120;
export const GOODS_STAR_EVERY = 5;
export const COMPOST_MAX = 40;
export const COMPOST_START = 1;

/** Markt: [vanaf goederen, effect]. */
export const MARKET: { from: number; compost?: number; actions: { kind: ActionKind; count?: number }[] }[] = [
  { from: 70, actions: [{ kind: 'perennial', count: 2 }, { kind: 'bonus' }] },
  { from: 50, actions: [{ kind: 'perennial', count: 2 }, { kind: 'fruit' }] },
  { from: 35, compost: 1, actions: [{ kind: 'perennial', count: 2 }] },
  { from: 20, actions: [{ kind: 'perennial' }, { kind: 'fruit' }] },
  { from: 4, compost: 1, actions: [{ kind: 'perennial' }] },
  { from: 0, compost: 1, actions: [] },
];

export const ROUNDS = 8;
