import { confetti } from '@shared/confetti';
import { h, mount, toast } from '@shared/dom';
import { addHistory } from '@shared/history';
import { initPage } from '@shared/page';
import { getRecentPlayers, rememberPlayers } from '@shared/players';
import { rulesButton } from '@shared/rules';
import { sessionStore } from '@shared/session';
import { readJSON, writeJSON } from '@shared/storage';
import {
  APIARY_AREA,
  BEAN_HEIGHT,
  BEAN_NEEDS_CORN,
  COMPOST_AREA,
  COMPOST_MAX,
  CORN_HEIGHT,
  ERF_H,
  ERF_W,
  FLOWER_COLORS,
  FLOWER_NAMES,
  FRUIT_ROWS,
  GOODS_AREA,
  GOODS_MAX,
  GOODS_STAR_EVERY,
  HIVE,
  JOURNAL_AREA,
  PERENNIALS,
  PERENNIAL_AREA,
  PUMPKINS,
  ROUNDS,
  SHED,
  TUIN_H,
  TUIN_W,
  UNITS,
  ZONE_BADGES,
  type FlowerId,
  type ShedId,
} from './data';
import erfUrl from './erf.webp';
import {
  ACTION_LABEL,
  TRACKS,
  addCompost,
  addGoods,
  compostAndGoods,
  compostLeft,
  emptySheet,
  growBean,
  growCorn,
  growPerennial,
  growPumpkin,
  previewWater,
  waterZone,
  growShed,
  growTrack,
  jobTarget,
  market,
  marketRow,
  rain,
  resolveJob,
  score,
  shedEvent,
  spendCompost,
  takeDie,
  useShovel,
  type Result,
  type Sheet,
} from './model';
import { TS_RULES } from './rules';
import { openTable, resetTable } from './table';
import './three-sisters.css';
import tuinUrl from './tuin.webp';

/**
 * Three Sisters: je eigen scoreblad (tuin + erf) op je eigen scherm.
 * Tik een gewas, vaste plant, fruitrij of schuuritem aan om het volgende vakje te vullen.
 * Goederen, compost, sterren en extra acties (journaal) houdt de app voor je bij.
 */

const GAME_ID = 'three-sisters';
const VERSION = 1;
const MAX_UNDO = 200;

interface TsState extends Sheet {
  version: typeof VERSION;
  player: string;
  undo: Sheet[];
}

const store = sessionStore<TsState>(GAME_ID, VERSION);
const LAST_KEY = `spel:${GAME_ID}:speler`;
const TAB_KEY = `spel:${GAME_ID}:tab`;

initPage({ root: '../../', keepAwake: true });

const app = mount('#app');
let state: TsState | null = store.load();
let tab = readJSON<'tuin' | 'erf'>(TAB_KEY, 'tuin');
/** Laatst water gegeven zone: even laten oplichten. */
let watered: { zone: number; at: number } | null = null;
/** Open keuzevenstertje "water geven in zone X?" met de plek (pixels op de tuintekening). */
let pendingWater: { zone: number; pos: [number, number] } | null = null;
const flash = (zone: number): boolean => watered !== null && watered.zone === zone && Date.now() - watered.at < 1200;

function sheetOf(s: TsState): Sheet {
  const { version: _v, player: _p, undo: _u, ...sheet } = s;
  return sheet;
}

/** Tablet staand: tuin en erf als twee "pagina's" naast elkaar waar je tussen veegt. */
const SWIPE = matchMedia('(min-width: 761px) and (max-width: 1099px)');

function render(): void {
  const prev = app.querySelector<HTMLElement>('.ts-boards');
  const left = prev ? prev.scrollLeft : null;
  app.classList.toggle('ts-wide', Boolean(state));
  app.replaceChildren(state ? playView(state) : setupView());
  setupSwipe(left);
}

function setupSwipe(left: number | null): void {
  const boards = app.querySelector<HTMLElement>('.ts-boards');
  if (!boards || !SWIPE.matches) return;
  boards.scrollLeft = left ?? (tab === 'erf' ? boards.scrollWidth : 0);
  let timer = 0;
  boards.addEventListener(
    'scroll',
    () => {
      window.clearTimeout(timer);
      timer = window.setTimeout(() => {
        const now = boards.scrollLeft > boards.clientWidth / 2 ? 'erf' : 'tuin';
        if (now === tab) return;
        tab = now;
        writeJSON(TAB_KEY, now);
        // Alleen de tabjes bijwerken; niet opnieuw tekenen (dat zou het vegen onderbreken)
        app.querySelectorAll<HTMLInputElement>('.ts-tabs input').forEach((input, k) => {
          input.checked = (k === 0 ? 'tuin' : 'erf') === now;
        });
      }, 80);
    },
    { passive: true },
  );
}

// Draaien van de tablet: opnieuw indelen
SWIPE.addEventListener('change', () => state && render());

/** Resultaat van een actie toepassen (of de fout tonen). */
function run(s: TsState, r: Result, el?: Element): void {
  if (r.error) {
    if (el) shake(el);
    toast(r.error);
    return;
  }
  state = { ...s, ...r.sheet, undo: [...s.undo, sheetOf(s)].slice(-MAX_UNDO) };
  store.save(state);
  render();
  if (r.messages.length) toast(r.messages.join(' · '), 3800);
}

function shake(el: Element): void {
  el.classList.remove('shake');
  void (el as HTMLElement).offsetWidth;
  el.classList.add('shake');
}

/** Positie in procenten op een tekening. */
function place(rect: [number, number, number, number], w: number, hgt: number): string {
  const [x, y, rw, rh] = rect;
  return `left:${(x / w) * 100}%;top:${(y / hgt) * 100}%;width:${(rw / w) * 100}%;height:${(rh / hgt) * 100}%`;
}

function at(pos: [number, number], w: number, hgt: number): string {
  return `left:${(pos[0] / w) * 100}%;top:${(pos[1] / hgt) * 100}%`;
}

/** Rijtje vakjes; `round` = index van rondjes (oogst). */
function boxes(total: number, filled: number, opts: { round?: (i: number) => boolean; vertical?: boolean; cls?: string } = {}): HTMLElement {
  const items = Array.from({ length: total }, (_, i) =>
    h('i', { class: `${opts.round?.(i) ? 'r' : ''}${i < filled ? ' on' : ''}` }),
  );
  if (opts.vertical) items.reverse(); // van onder naar boven
  return h('span', { class: `ts-boxes${opts.vertical ? ' v' : ''}${opts.cls ? ` ${opts.cls}` : ''}` }, items);
}

/* ------------------------------------------------------------------ */
/* Start                                                               */
/* ------------------------------------------------------------------ */

function setupView(): HTMLElement {
  let player = readJSON<string>(LAST_KEY, '');
  const nameInput = h('input', {
    type: 'text',
    value: player,
    placeholder: 'Je naam (optioneel)',
    autocomplete: 'off',
    oninput: (e: Event) => {
      player = (e.target as HTMLInputElement).value;
    },
  });
  const start = (e: Event): void => {
    e.preventDefault();
    const name = player.trim();
    writeJSON(LAST_KEY, name);
    if (name) rememberPlayers([name]);
    state = { version: VERSION, player: name, ...emptySheet(), undo: [] };
    resetTable();
    store.save(state);
    render();
  };
  return h(
    'form',
    { onsubmit: start },
    h('div', { class: 'topbar' }, h('a', { class: 'btn btn-ghost', href: '../../' }, '‹ Spellen'), h('h1', null, 'Three Sisters'), rulesButton(TS_RULES)),
    h(
      'div',
      { class: 'card' },
      h(
        'p',
        { style: 'margin-top:0' },
        'Iedereen houdt zijn eigen tuin en erf bij op zijn eigen scherm. De dobbelstenen en de draaischijf liggen gewoon op tafel. Nieuw? Tik op het vraagteken.',
      ),
      h(
        'label',
        { class: 'field' },
        h('span', null, 'Wie ben je?'),
        nameInput,
        h(
          'div',
          { class: 'chips' },
          getRecentPlayers().map((name) =>
            h('button', { type: 'button', class: 'chip', onclick: () => ((player = name), (nameInput.value = name)) }, name),
          ),
        ),
      ),
    ),
    h('div', { class: 'actions row stretch' }, h('button', { type: 'submit', class: 'btn-primary btn-big' }, 'Start')),
  );
}

/* ------------------------------------------------------------------ */
/* Spel                                                                */
/* ------------------------------------------------------------------ */

function playView(s: TsState): HTMLElement {
  const sc = score(s);
  const tabs = h(
    'div',
    { class: 'segmented ts-tabs', role: 'tablist' },
    (['tuin', 'erf'] as const).map((t) =>
      h(
        'label',
        null,
        h('input', {
          type: 'radio',
          name: 'ts-tab',
          checked: tab === t,
          onchange: () => {
            tab = t;
            writeJSON(TAB_KEY, t);
            const boards = app.querySelector<HTMLElement>('.ts-boards');
            if (boards && SWIPE.matches) {
              boards.scrollTo({ left: t === 'erf' ? boards.scrollWidth : 0, behavior: 'smooth' });
              return;
            }
            render();
          },
        }),
        t === 'tuin' ? '🌽 Tuin' : '🐝 Erf',
      ),
    ),
  );

  return h(
    'div',
    { class: `ts tab-${tab}` },
    h(
      'div',
      { class: 'topbar' },
      h('a', { class: 'btn btn-ghost', href: '../../' }, '‹'),
      h('h1', null, 'Three Sisters', s.player ? h('span', { class: 'muted' }, ` · ${s.player}`) : null),
      h(
        'button',
        {
          type: 'button',
          class: 'ts-roundpill',
          title: 'Ronde (tik = volgende)',
          onclick: () => run(s, { sheet: { ...sheetOf(s), round: s.round >= ROUNDS ? 1 : s.round + 1 }, messages: [] }),
        },
        `Ronde ${s.round}/${ROUNDS}`,
      ),
      h('span', { class: 'ts-totalpill', title: 'Totaal' }, `${sc.total} pt`),
      h('button', { type: 'button', class: 'ts-boardbtn', title: 'Prikbord: stenen en rondes', 'aria-label': 'Prikbord', onclick: () => showTable() }, '📌'),
      rulesButton(TS_RULES),
    ),
    tabs,
    h('div', { class: 'ts-boards' }, gardenBoard(s), yardBoard(s)),
    sidePanel(s),
    h(
      'div',
      { class: 'actions row stretch' },
      h('button', {
        class: 'btn-undo',
        disabled: s.undo.length === 0,
        'aria-label': 'Ongedaan maken',
        title: 'Ongedaan maken',
        innerHTML:
          '<svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M9 14 4 9l5-5"/><path d="M4 9h10.5a5.5 5.5 0 0 1 0 11H11"/></svg>',
        onclick: () => {
          const prev = s.undo.at(-1);
          if (!prev) return;
          state = { ...s, ...prev, undo: s.undo.slice(0, -1) };
          store.save(state);
          render();
        },
      }),
      h('button', { class: 'btn-ghost btn-danger btn-clear', onclick: () => clearGame() }, 'Wissen'),
      h('button', { class: 'btn-primary', onclick: () => finishGame(s) }, 'Afronden'),
    ),
  );
}

/* ---------- Tuin ---------- */

function gardenBoard(s: TsState): HTMLElement {
  const W = TUIN_W;
  const H = TUIN_H;
  const layer = h('div', { class: 'ts-layer' });
  const preview = pendingWater ? previewWater(s, pendingWater.zone) : null;
  if (pendingWater) layer.classList.add('asking');

  UNITS.forEach((u, i) => {
    const corn = s.corn[i] ?? 0;
    const bean = s.bean[i] ?? 0;
    const beanReady = bean > 0 || corn >= BEAN_NEEDS_CORN;
    layer.append(
      h(
        'div',
        { class: `ts-unit${flash(u.zone) ? ' watered' : ''}${preview?.units.includes(i) ? ' will-grow' : ''}`, style: place(u.rect, W, H) },
        h(
          'button',
          {
            type: 'button',
            class: `ts-crop corn${corn >= CORN_HEIGHT ? ' done' : ''}`,
            'aria-label': `Mais zone ${u.zone}: ${corn}/${CORN_HEIGHT}`,
            onclick: (e: Event) => cropTap(s, 'corn', i, e.currentTarget as Element),
          },
          h('b', { class: 'ts-rib corn' }, '3'),
          boxes(CORN_HEIGHT, corn, { vertical: true, round: (k) => k === CORN_HEIGHT - 1 }),
        ),
        h(
          'button',
          {
            type: 'button',
            class: `ts-crop bean${bean >= BEAN_HEIGHT ? ' done' : ''}${beanReady ? '' : ' wait'}`,
            'aria-label': `Boon zone ${u.zone}: ${bean}/${BEAN_HEIGHT}`,
            onclick: (e: Event) => cropTap(s, 'bean', i, e.currentTarget as Element),
          },
          h('b', { class: 'ts-rib bean' }, '1'),
          boxes(BEAN_HEIGHT, bean, { vertical: true, round: (k) => k === BEAN_HEIGHT - 1 }),
        ),
      ),
    );
  });

  // Bloemen tussen de pompoenen, uitgeschreven zoals op het blad
  PUMPKINS.forEach((p, i) => {
    const q = PUMPKINS[(i + 1) % PUMPKINS.length] as (typeof PUMPKINS)[number];
    const both = (s.pumpkin[i] ?? 0) >= p.height && (s.pumpkin[(i + 1) % PUMPKINS.length] ?? 0) >= q.height;
    const pending = both && s.journal.some((j) => j.kind === p.between && j.source.includes('pompoen'));
    layer.append(
      h(
        pending ? 'button' : 'span',
        {
          ...(pending ? { type: 'button', onclick: (e: Event) => fillPerennial(s, p.between, e.currentTarget as Element) } : {}),
          class: `ts-flower${both ? ' on' : ''}${pending ? ' pending' : ''}`,
          style: `${at(p.label, W, H)};--c:${FLOWER_COLORS[p.between]}`,
          title: pending
            ? `Tik om een vakje ${FLOWER_NAMES[p.between]} in te kleuren`
            : `${FLOWER_NAMES[p.between]}: oogst de twee pompoenen ernaast`,
        },
        h('i', { 'aria-hidden': 'true' }, '✿'),
        FLOWER_NAMES[p.between],
        pending ? h('em', null, '+1 ›') : null,
      ),
    );
  });

  PUMPKINS.forEach((p, i) => {
    const v = s.pumpkin[i] ?? 0;
    layer.append(
      h(
        'button',
        {
          type: 'button',
          class: `ts-pumpkin${v >= p.height ? ' done' : ''}${flash(p.zone) ? ' watered' : ''}${preview?.pumpkins.includes(i) ? ' will-grow' : ''}`,
          style: at(p.pos, W, H),
          'aria-label': `Pompoen zone ${p.zone}: ${v}/${p.height}`,
          onclick: (e: Event) => {
            if (v === 0) run(s, growPumpkin(s, i), e.currentTarget as Element);
            else if (v >= p.height) toast('Deze pompoen is al geoogst');
            else askWater(p.zone, p.pos);
          },
        },
        h('b', { class: 'ts-goods' }, `${p.goods}📦`),
        boxes(p.height, v, { vertical: true, round: (k) => k === p.height - 1 }),
      ),
    );
  });

  Object.entries(ZONE_BADGES).forEach(([zone, pos]) => {
    layer.append(
      h('span', { class: 'ts-zone', style: at(pos, W, H), 'aria-hidden': 'true' }, zone),
    );
  });

  // Vaste planten
  layer.append(
    h(
      'div',
      { class: 'ts-perennials', style: place(PERENNIAL_AREA, W, H) },
      PERENNIALS.map((p) => {
        const v = s.per[p.id];
        const owed = s.journal.filter((j) => j.kind === p.id).length;
        return h(
          'button',
          {
            type: 'button',
            class: `ts-per${v >= p.steps.length ? ' done' : ''}${owed ? ' pending' : ''}`,
            style: `--c:${FLOWER_COLORS[p.id]}`,
            'aria-label': `${FLOWER_NAMES[p.id]}: ${v}/${p.steps.length}${owed ? `, nog ${owed} in te kleuren` : ''}`,
            onclick: (e: Event) => fillPerennial(s, p.id, e.currentTarget as Element),
          },
          owed ? h('span', { class: 'ts-per-owed' }, `+${owed}`) : null,
          h(
            'span',
            { class: 'ts-per-steps' },
            [...p.steps]
              .map((st, k) =>
                h(
                  'span',
                  { class: `ts-step${k < v ? ' on' : ''}${k === v ? ' next' : ''}${k === p.steps.length - 1 ? ' pts' : ''}` },
                  h('i'),
                  h('small', null, st.label ?? ''),
                ),
              )
              .reverse(),
          ),
          h('b', null, FLOWER_NAMES[p.id]),
        );
      }),
    ),
  );

  return h(
    'div',
    { class: 'ts-board garden' },
    h('img', { src: tuinUrl, alt: '', width: W, height: H, draggable: false }),
    layer,
    ...waterPopover(s),
  );
}

/** Tik op een kolom = volgende vakje (eerste tik = planten, daarna = water geven). */
/**
 * Tik op een kolom:
 *  - nog niet geplant → planten (alleen deze plant)
 *  - al geplant → water geven in de hele zone (alle geplante gewassen daar groeien één vakje)
 */
function cropTap(s: TsState, kind: 'corn' | 'bean', i: number, el: Element): void {
  const planted = kind === 'corn' ? (s.corn[i] ?? 0) > 0 : (s.bean[i] ?? 0) > 0;
  if (!planted) {
    run(s, kind === 'corn' ? growCorn(s, i) : growBean(s, i), el);
    return;
  }
  const full = kind === 'corn' ? (s.corn[i] ?? 0) >= CORN_HEIGHT : (s.bean[i] ?? 0) >= BEAN_HEIGHT;
  if (full) {
    toast('Al geoogst. Water geven in deze zone? Tik op een gewas dat nog groeit.');
    return;
  }
  const u = UNITS[i];
  if (!u) return;
  void el;
  askWater(u.zone, [u.rect[0] + u.rect[2] / 2, u.rect[1] + u.rect[3] / 2]);
}

function askWater(zone: number, pos: [number, number]): void {
  pendingWater = pendingWater?.zone === zone ? null : { zone, pos };
  render();
}

/** Water geven in een zone, met een korte oplichting van die zone. */
function water(s: TsState, zone: number): void {
  pendingWater = null;
  watered = { zone, at: Date.now() };
  run(s, waterZone(s, zone));
}

/** Het keuzevenstertje: laat zien wat er groeit en wat er geoogst wordt. */
function waterPopover(s: TsState): HTMLElement[] {
  if (!pendingWater) return [];
  const { zone, pos } = pendingWater;
  const pv = previewWater(s, zone);
  const harvest = [
    pv.corn ? `${pv.corn} mais` : '',
    pv.bean ? `${pv.bean} ${pv.bean === 1 ? 'boon' : 'bonen'}` : '',
    pv.pumpkin ? `${pv.pumpkin} ${pv.pumpkin === 1 ? 'pompoen' : 'pompoenen'}` : '',
  ].filter(Boolean);
  const x = (pos[0] / TUIN_W) * 100;
  const below = pos[1] / TUIN_H < 0.45;
  const y = (pos[1] / TUIN_H) * 100 + (below ? 6 : -6);
  const close = (): void => {
    pendingWater = null;
    render();
  };
  return [
    h('button', { type: 'button', class: 'ts-pop-backdrop', 'aria-label': 'Annuleren', onclick: close }),
    h(
      'div',
      { class: `ts-pop ${below ? 'below' : 'above'}`, style: `left:clamp(min(170px, 50%), ${x}%, max(calc(100% - 170px), 50%));top:${y}%`, role: 'dialog', 'aria-label': `Water geven in zone ${zone}` },
      h(
        'p',
        null,
        h('b', null, `Zone ${zone}`),
        pv.grow === 0
          ? ' · niets om water te geven'
          : ` · ${pv.grow} ${pv.grow === 1 ? 'gewas groeit' : 'gewassen groeien'}${harvest.length ? `, oogst: ${harvest.join(', ')}` : ''}`,
      ),
      h(
        'div',
        { class: 'ts-pop-actions' },
        h('button', { type: 'button', class: 'btn-ghost', onclick: close }, 'Annuleren'),
        h('button', { type: 'button', class: 'btn-primary', disabled: pv.grow === 0, onclick: () => water(s, zone) }, '💧 Water geven'),
      ),
    ),
  ];
}

/* ---------- Zone-paneel ---------- */

/**
 * Vaste plant invullen. Staat er in het journaal een actie voor precies deze bloem
 * (bv. van twee pompoenen) of een "vaste plant naar keuze", dan wordt die meteen afgestreept.
 */
function fillPerennial(s: TsState, f: FlowerId, el?: Element): void {
  const r = growPerennial(s, f);
  if (r.error) {
    if (el) shake(el);
    toast(r.error);
    return;
  }
  const job = s.journal.find((j) => j.kind === f) ?? s.journal.find((j) => j.kind === 'perennial');
  if (job) {
    run(s, { ...r, sheet: resolveJob(r.sheet, job.id), messages: [`✓ ${FLOWER_NAMES[f]} ingevuld (${job.source})`, ...r.messages] });
  } else run(s, r);
}

/** Het prikbord (gedeeld scherm voor de stenen en de rondes). */
function showTable(): void {
  const cur = (): TsState | null => state;
  openTable({
    round: () => cur()?.round ?? 1,
    setRound: (r) => {
      const s = cur();
      if (s) run(s, { sheet: { ...sheetOf(s), round: r }, messages: [] });
    },
    takeForMe: (value, space) => {
      const s = cur();
      if (s) run(s, takeDie(s, value, space));
    },
    event: (e) => {
      const s = cur();
      if (!s) return;
      run(s, e === 'rain' ? rain(s) : e === 'market' ? market(s) : shedEvent(s));
    },
  });
}

function openDialog(title: string, body: (close: () => void) => (HTMLElement | null)[]): void {
  const dialog = h('dialog', { class: 'rules-dialog ts-dialog' });
  const close = (): void => dialog.close();
  dialog.append(
    h('div', { class: 'rules-head' }, h('h2', null, title), h('button', { type: 'button', class: 'btn-ghost', 'aria-label': 'Sluiten', onclick: close }, '✕')),
    h('div', { class: 'rules-body' }, body(close)),
  );
  dialog.addEventListener('close', () => dialog.remove());
  dialog.addEventListener('click', (e) => {
    if (e.target === dialog) close();
  });
  document.body.append(dialog);
  dialog.showModal();
}

/* ---------- Erf ---------- */

function yardBoard(s: TsState): HTMLElement {
  const W = ERF_W;
  const H = ERF_H;
  const layer = h('div', { class: 'ts-layer' });
  const hiveFull = (s.tracks.hive ?? 0) >= HIVE.cells.length;

  // Bijenstal
  const col = (id: string, title: string): HTMLElement => {
    const t = TRACKS[id];
    if (!t) return h('span');
    const v = s.tracks[id] ?? 0;
    const locked = id !== 'hive' && !hiveFull;
    return h(
      'button',
      {
        type: 'button',
        class: `ts-api${locked ? ' locked' : ''}${v >= t.cells.length ? ' done' : ''}`,
        onclick: (e: Event) => run(s, growTrack(s, id), e.currentTarget as Element),
      },
      h('b', null, title),
      h(
        'span',
        { class: 'ts-api-cells' },
        [...t.cells].map((c, k) => h('span', { class: `ts-cell${c.round ? ' r' : ''}${k < v ? ' on' : ''}${k === v ? ' next' : ''}` }, h('i'), c.label ? h('small', null, c.label) : null)).reverse(),
      ),
    );
  };
  layer.append(
    h(
      'div',
      { class: 'ts-apiary', style: place(APIARY_AREA, W, H) },
      h('div', { class: 'ts-api-top' }, col('wax', 'Was'), col('honey', 'Honing'), col('split', 'Splitsen')),
      col('hive', 'Bijenkast'),
    ),
  );

  // Fruit
  Object.entries(FRUIT_ROWS).forEach(([id, rect]) => {
    const t = TRACKS[id];
    if (!t) return;
    const v = s.tracks[id] ?? 0;
    layer.append(
      h(
        'button',
        {
          type: 'button',
          class: `ts-fruit${v >= t.cells.length ? ' done' : ''}`,
          style: place(rect, W, H),
          'aria-label': `${t.name}: ${v}/${t.cells.length}`,
          onclick: (e: Event) => run(s, growTrack(s, id), e.currentTarget as Element),
        },
        h('b', null, t.name),
        h(
          'span',
          { class: 'ts-fruit-cells' },
          t.cells.map((c, k) =>
            h('span', { class: `ts-cell${c.round ? ' r' : ''}${k < v ? ' on' : ''}` }, h('i'), c.points ? h('small', null, `${c.points}`) : c.effect?.goods ? h('small', null, `+${c.effect.goods}`) : c.label ? h('small', null, '💧') : null),
          ),
        ),
      ),
    );
  });

  // Schuur
  SHED.forEach((item) => {
    const v = s.shed[item.id];
    layer.append(
      h(
        'button',
        {
          type: 'button',
          class: `ts-shed${v >= item.boxes ? ' done' : ''}`,
          style: place(item.rect, W, H),
          'aria-label': `${item.name}: ${v}/${item.boxes}`,
          onclick: (e: Event) => run(s, growShed(s, item.id as ShedId), e.currentTarget as Element),
        },
        h('b', null, item.name),
        item.text ? h('small', null, item.text) : null,
        h(
          'span',
          { class: 'ts-shed-foot' },
          boxes(item.boxes, v, { round: (k) => k === item.boxes - 1 }),
          item.points ? h('em', null, `${item.points}pt`) : null,
        ),
      ),
    );
  });

  // Eindscore in het journaal-vlak
  const sc = score(s);
  layer.append(
    h(
      'div',
      { class: 'ts-final', style: place(JOURNAL_AREA, W, H) },
      h(
        'table',
        null,
        h(
          'tbody',
          null,
          ([
            ['Tuin', sc.garden],
            ['Vaste planten', sc.perennials],
            ['Bijenstal', sc.apiary],
            ['Fruit', sc.fruit],
            ['Schuur', sc.shed],
          ] as [string, number][]).map(([k, v]) => h('tr', null, h('th', null, k), h('td', null, String(v)))),
          h('tr', { class: 'total' }, h('th', null, 'Totaal'), h('td', null, String(sc.total))),
        ),
      ),
    ),
  );

  // Goederen
  const stars = Math.floor(s.goods / GOODS_STAR_EVERY);
  layer.append(
    h(
      'button',
      { type: 'button', class: 'ts-goodsbox', style: place(GOODS_AREA, W, H), onclick: () => openGoods(s) },
      h('b', null, `📦 ${s.goods}`, h('small', null, ` · ⭐ ${stars} · markt: ${marketRow(s.goods).from}+`)),
      h(
        'span',
        { class: 'ts-grid goods' },
        Array.from({ length: GOODS_MAX }, (_, k) => h('i', { class: `${(k + 1) % GOODS_STAR_EVERY === 0 ? 'star' : ''}${k < s.goods ? ' on' : ''}` })),
      ),
    ),
  );

  // Compost
  layer.append(
    h(
      'button',
      { type: 'button', class: 'ts-compostbox', style: place(COMPOST_AREA, W, H), onclick: () => openCompost(s) },
      h('b', null, `🟫 ${compostLeft(s)}`, h('small', null, ' compost')),
      h(
        'span',
        { class: 'ts-grid compost' },
        Array.from({ length: COMPOST_MAX }, (_, k) => h('i', { class: `${k < s.compost ? 'on' : ''}${k < s.compostSpent ? ' spent' : ''}` })),
      ),
    ),
  );

  return h('div', { class: 'ts-board yard' }, h('img', { src: erfUrl, alt: '', width: W, height: H, draggable: false }), layer);
}

function openGoods(s: TsState): void {
  openDialog(`Goederen: ${s.goods}`, (close) => {
    const act = (n: number): void => {
      close();
      if (state) run(state, addGoods(state, n));
    };
    return [
      h('p', { class: 'muted' }, 'Meestal telt de app goederen vanzelf (pompoenen, frambozen, was, hyacinten, rondel). Hier kun je bijtellen of corrigeren. Elke 5e is een ster = bonusactie.'),
      h('div', { class: 'ts-btnrow' }, [1, 2, 3, 4].map((n) => h('button', { type: 'button', class: 'btn-primary', onclick: () => act(n) }, `+${n}`)), h('button', { type: 'button', onclick: () => act(-1) }, '−1')),
    ];
  });
}

function openCompost(s: TsState): void {
  openDialog(`Compost: ${compostLeft(s)} beschikbaar`, (close) => {
    const act = (r: (c: TsState) => Result): void => {
      close();
      if (state) run(state, r(state));
    };
    return [
      h('p', { class: 'muted' }, 'Besteed 1 compost om de steen bij planten of water geven 1 hoger of lager te maken (6 ↔ 1 mag rond).'),
      h(
        'div',
        { class: 'ts-btnrow' },
        h('button', { type: 'button', class: 'btn-primary', disabled: compostLeft(s) < 1, onclick: () => act((c) => spendCompost(c, 1)) }, 'Besteed 1 (±1)'),
        h('button', { type: 'button', onclick: () => act((c) => addCompost(c, 1)) }, '+1 compost'),
        h('button', { type: 'button', onclick: () => act((c) => addCompost(c, -1)) }, '−1 correctie'),
      ),
      h(
        'button',
        { type: 'button', class: 'ts-shovel', disabled: s.shed.shovel < 2 || compostLeft(s) < 3, onclick: () => act(useShovel) },
        '🪏 Schep: 3 compost → ⭐ bonusactie',
      ),
    ];
  });
}

/* ---------- Acties en journaal ---------- */

function sidePanel(s: TsState): HTMLElement {
  const quick = h(
    'div',
    { class: 'ts-quick' },
    h('button', { type: 'button', onclick: () => run(s, compostAndGoods(s)) }, h('b', null, '+1 🟫 +4 📦'), h('small', null, 'Rondel')),
    h('button', { type: 'button', onclick: () => run(s, market(s)) }, h('b', null, '🧺 Markt'), h('small', null, `${s.goods} → rij ${marketRow(s.goods).from}+`)),
    h('button', { type: 'button', onclick: () => run(s, rain(s)) }, h('b', null, '🌧️ Regen'), h('small', null, 'Water overal')),
    h('button', { type: 'button', onclick: () => openCompost(s) }, h('b', null, `🟫 ${compostLeft(s)}`), h('small', null, 'Compost')),
  );

  const journal = h(
    'div',
    { class: 'ts-journal' },
    h('h3', null, '📓 Journaal', s.journal.length ? h('span', { class: 'ts-count' }, String(s.journal.length)) : null),
    s.journal.length === 0
      ? h('p', { class: 'muted' }, 'Geen openstaande acties. Extra acties (sterren, pompoenen, bonussen) verschijnen hier.')
      : h(
          'ul',
          null,
          s.journal.map((j) => {
            const target = jobTarget(j.kind);
            const color = (FLOWER_COLORS as Record<string, string>)[j.kind];
            return h(
              'li',
              { style: color ? `--c:${color}` : '' },
              h('span', null, h('b', null, ACTION_LABEL[j.kind]), h('small', null, j.source)),
              target
                ? h(
                    'button',
                    {
                      type: 'button',
                      class: 'btn-primary',
                      onclick: () => {
                        const r = target(s);
                        if (r.error) return toast(r.error);
                        run(s, { ...r, sheet: resolveJob(r.sheet, j.id) });
                      },
                    },
                    'Invullen',
                  )
                : null,
              h(
                'button',
                { type: 'button', class: 'btn-ghost', 'aria-label': 'Gedaan', title: 'Gedaan', onclick: () => run(s, { sheet: resolveJob(sheetOf(s), j.id), messages: [] }) },
                '✓',
              ),
            );
          }),
        ),
  );
  return h('div', { class: 'ts-side' }, quick, journal);
}

/* ------------------------------------------------------------------ */
/* Afronden                                                            */
/* ------------------------------------------------------------------ */

function finishGame(s: TsState): void {
  const sc = score(s);
  if (!confirm(`Afronden met ${sc.total} punten en opslaan bij "Gespeeld"?`)) return;
  const name = s.player || 'Ik';
  addHistory({ gameId: GAME_ID, title: 'Three Sisters', players: [{ name, score: sc.total }], winners: [name] });
  store.clear();
  state = null;
  render();
  confetti();
  toast(`${sc.total} punten opgeslagen`);
}

function clearGame(): void {
  if (!confirm('Blad wissen zonder op te slaan?')) return;
  store.clear();
  state = null;
  render();
}

render();


