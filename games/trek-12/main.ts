import { confetti } from '@shared/confetti';
import { h, mount, toast } from '@shared/dom';
import { addHistory } from '@shared/history';
import { initPage } from '@shared/page';
import { getRecentPlayers, rememberPlayers } from '@shared/players';
import { rulesButton } from '@shared/rules';
import { sessionStore } from '@shared/session';
import { readJSON, writeJSON } from '@shared/storage';
import {
  MAX_CARDS,
  OPS,
  TICKS_PER_OP,
  adjacency,
  canPlace,
  checkGroup,
  emptySheet,
  filledCount,
  groupPoints,
  lineOrder,
  opValue,
  orphans,
  place,
  resultFor,
  score,
  type Group,
  type Op,
  type Sheet,
} from './model';
import { MOUNTAINS, mountainById, type Mountain } from './mountains';
import { TREK12_RULES } from './rules';
import { SCENE_SVG } from './scene';
import './trek12.css';

/**
 * Trek 12: je eigen berg op je eigen scherm.
 * Invullen: dobbelstenen kiezen → uitkomst → rondje. Daarna lijnen en zones tekenen;
 * de app controleert de regels en telt alles op.
 */

const GAME_ID = 'trek-12';
const VERSION = 1;
const MAX_UNDO = 200;

type Phase = 'play' | 'score';

interface Roll {
  red: number | null;
  yellow: number | null;
}

interface Snapshot {
  sheet: Sheet;
  phase: Phase;
  roll: Roll;
  op: Op | null;
}

interface TrekState extends Snapshot {
  version: typeof VERSION;
  player: string;
  mountain: string;
  undo: Snapshot[];
}

const store = sessionStore<TrekState>(GAME_ID, VERSION);
const LAST_KEY = `spel:${GAME_ID}:speler`;
const recordKey = (id: string): string => `spel:${GAME_ID}:record:${id}`;

const RED_FACES = [1, 2, 3, 4, 5, 6];
const YELLOW_FACES = [0, 1, 2, 3, 4, 5];

const UNDO_ICON =
  '<svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M9 14 4 9l5-5"/><path d="M4 9h10.5a5.5 5.5 0 0 1 0 11H11"/></svg>';

initPage({ root: '../../', keepAwake: true });

const app = mount('#app');
let state: TrekState | null = store.load();
/** Selectie bij het tekenen van groepen (niet opgeslagen). */
let selection: number[] = [];

function render(): void {
  app.classList.toggle('t12-wide', Boolean(state));
  app.replaceChildren(state ? playView(state) : setupView());
}

function snapshot(s: TrekState): Snapshot {
  return { sheet: s.sheet, phase: s.phase, roll: s.roll, op: s.op };
}

function apply(s: TrekState, next: Partial<Snapshot>, remember = true): void {
  const undo = remember ? [...s.undo, snapshot(s)].slice(-MAX_UNDO) : s.undo;
  state = { ...s, ...next, undo };
  store.save(state);
  render();
}

function fmt(n: number): string {
  return n < 0 ? `−${-n}` : String(n);
}

function shake(el: Element): void {
  el.classList.remove('shake');
  void (el as HTMLElement).getBoundingClientRect();
  el.classList.add('shake');
}

/* ------------------------------------------------------------------ */
/* Start                                                               */
/* ------------------------------------------------------------------ */

function setupView(): HTMLElement {
  let player = readJSON<string>(LAST_KEY, '');
  let mountainId = MOUNTAINS.find((m) => m.available)?.id ?? 'dunai';

  const nameInput = h('input', {
    type: 'text',
    value: player,
    placeholder: 'Je naam (optioneel)',
    autocomplete: 'off',
    oninput: (e: Event) => {
      player = (e.target as HTMLInputElement).value;
    },
  });

  const mountainList = h('div', { class: 't12-mountains' });
  const renderMountains = (): void => {
    mountainList.replaceChildren(
      ...MOUNTAINS.map((m) => {
        const record = readJSON<number | null>(recordKey(m.id), null);
        return h(
          'button',
          {
            type: 'button',
            class: `t12-mountain${m.id === mountainId ? ' selected' : ''}`,
            disabled: !m.available,
            'aria-pressed': String(m.id === mountainId),
            onclick: () => {
              mountainId = m.id;
              renderMountains();
            },
          },
          h('strong', null, m.name),
          h('span', { class: 't12-diff', 'aria-label': `moeilijkheid ${m.difficulty}` }, '★'.repeat(Math.ceil(m.difficulty / 3))),
          h(
            'small',
            { class: 'muted' },
            m.available ? `Top: ${m.summit}+${record !== null ? ` · record ${record}` : ''}` : 'binnenkort',
          ),
        );
      }),
    );
  };
  renderMountains();

  const start = (e: Event): void => {
    e.preventDefault();
    const m = mountainById(mountainId);
    if (!m?.available) return;
    const name = player.trim();
    writeJSON(LAST_KEY, name);
    if (name) rememberPlayers([name]);
    selection = [];
    state = {
      version: VERSION,
      player: name,
      mountain: m.id,
      sheet: emptySheet(m),
      phase: 'play',
      roll: { red: null, yellow: null },
      op: null,
      undo: [],
    };
    store.save(state);
    render();
  };

  return h(
    'form',
    { onsubmit: start },
    h(
      'div',
      { class: 'topbar' },
      h('a', { class: 'btn btn-ghost', href: '../../' }, '‹ Spellen'),
      h('h1', null, 'Trek 12'),
      rulesButton(TREK12_RULES),
    ),
    h(
      'div',
      { class: 'card' },
      h('p', { style: 'margin-top:0' }, 'Iedereen vult zijn eigen berg in op zijn eigen scherm. Nieuw met Trek 12? Tik op het vraagteken voor de spelregels.'),
      h(
        'label',
        { class: 'field' },
        h('span', null, 'Wie ben je?'),
        nameInput,
        h(
          'div',
          { class: 'chips' },
          getRecentPlayers().map((name) =>
            h(
              'button',
              {
                type: 'button',
                class: 'chip',
                onclick: () => {
                  player = name;
                  nameInput.value = name;
                },
              },
              name,
            ),
          ),
        ),
      ),
      h('div', { class: 'field' }, h('span', null, 'Welke berg?'), mountainList),
    ),
    h('div', { class: 'actions row stretch' }, h('button', { type: 'submit', class: 'btn-primary btn-big' }, 'Start')),
  );
}

/* ------------------------------------------------------------------ */
/* Spel                                                                */
/* ------------------------------------------------------------------ */

function playView(s: TrekState): HTMLElement {
  const m = mountainById(s.mountain) ?? (MOUNTAINS[0] as Mountain);
  const full = filledCount(s.sheet) === m.spots.length;

  return h(
    'div',
    null,
    h(
      'div',
      { class: 'topbar' },
      h('a', { class: 'btn btn-ghost', href: '../../', 'aria-label': 'Terug naar spellen' }, '‹'),
      h('h1', null, 'Trek 12 ', h('span', { class: 'muted' }, `· ${m.name}`)),
      rulesButton(TREK12_RULES),
    ),
    h(
      'div',
      { class: `t12 phase-${s.phase}` },
      mapView(m, s),
      scoreBar(m, s),
      h('div', { class: 't12-side' }, s.phase === 'play' ? playPanel(m, s) : groupPanel(m, s, full)),
    ),
    h(
      'div',
      { class: 'actions row stretch' },
      h('button', {
        class: 'btn-undo',
        disabled: s.undo.length === 0,
        'aria-label': 'Ongedaan maken',
        title: 'Ongedaan maken',
        innerHTML: UNDO_ICON,
        onclick: () => {
          const prev = s.undo.at(-1);
          if (!prev) return;
          selection = [];
          state = { ...s, ...prev, undo: s.undo.slice(0, -1) };
          store.save(state);
          render();
        },
      }),
      h('button', { class: 'btn-ghost btn-danger btn-clear', onclick: () => clearGame() }, 'Wissen'),
      s.phase === 'score'
        ? h('button', { class: 'btn-primary', onclick: () => finishGame(m, s) }, 'Afronden')
        : h(
            'button',
            {
              class: 'btn-primary',
              disabled: filledCount(s.sheet) === 0,
              onclick: () => {
                if (!full && !confirm('Nog niet alle rondjes zijn gevuld. Toch naar de telling?')) return;
                selection = [];
                apply(s, { phase: 'score', roll: { red: null, yellow: null }, op: null });
              },
            },
            'Naar telling',
          ),
    ),
  );
}

/* ---------- Kaart ---------- */

const SVG_NS = 'http://www.w3.org/2000/svg';
function svg(tag: string, attrs: Record<string, string | number>, text?: string): SVGElement {
  const el = document.createElementNS(SVG_NS, tag);
  for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, String(v));
  if (text !== undefined) el.textContent = text;
  return el;
}

function mapView(m: Mountain, s: TrekState): HTMLElement {
  const r = m.radius;
  const adj = adjacency(m);
  const root = svg('svg', { viewBox: '0 0 1000 620', class: 't12-map', role: 'group', 'aria-label': `Berg ${m.name}` });
  const scene = svg('g', { 'aria-hidden': 'true' });
  scene.innerHTML = SCENE_SVG;
  root.append(scene);

  const value = s.roll.red !== null && s.roll.yellow !== null && s.op ? opValue(s.op, s.roll.red, s.roll.yellow) : null;
  const orphanSet = s.phase === 'score' ? new Set(orphans(s.sheet)) : new Set<number>();

  // Zones: blauwe vlek onder de rondjes
  const zones = svg('g', { class: 't12-zones' });
  s.sheet.groups.forEach((g) => {
    if (g.kind !== 'zone') return;
    const blob = svg('g', { class: 't12-zone' });
    for (const a of g.cells) {
      for (const b of adj[a] ?? []) {
        if (b > a && g.cells.includes(b)) {
          const p = m.spots[a];
          const q = m.spots[b];
          if (p && q) blob.append(svg('line', { x1: p.x, y1: p.y, x2: q.x, y2: q.y }));
        }
      }
      const p = m.spots[a];
      if (p) blob.append(svg('circle', { cx: p.x, cy: p.y, r: r + 11 }));
    }
    zones.append(blob);
  });
  root.append(zones);

  // Rondjes
  const discs = svg('g', { class: 't12-discs' });
  m.spots.forEach((p, i) => {
    const cell = s.sheet.cells[i];
    const classes = ['t12-spot'];
    if (p.danger) classes.push('danger');
    if (cell !== null) classes.push('filled');
    discs.append(svg('circle', { cx: p.x, cy: p.y, r, class: classes.join(' ') }));
  });
  root.append(discs);

  // Lijnen: touw over de rondjes heen
  const ropes = svg('g', { class: 't12-lines' });
  s.sheet.groups.forEach((g) => {
    if (g.kind !== 'line') return;
    const pts = lineOrder(s.sheet, g.cells)
      .map((c) => m.spots[c])
      .filter(Boolean)
      .map((p) => `${p?.x},${p?.y}`)
      .join(' ');
    ropes.append(svg('polyline', { points: pts, class: 't12-rope' }));
    ropes.append(svg('polyline', { points: pts, class: 't12-rope-core' }));
  });
  root.append(ropes);

  // Getallen, doodshoofden en tikvlakken
  const marks = svg('g', { class: 't12-marks' });
  m.spots.forEach((p, i) => {
    const cell = s.sheet.cells[i];
    const placeable = s.phase === 'play' && canPlace(m, s.sheet, i);
    const target = placeable && value !== null;
    const selected = selection.includes(i);

    const g = svg('g', {
      class: `t12-hit${target ? ' target' : ''}${placeable && value === null ? ' open' : ''}${selected ? ' selected' : ''}`,
      role: 'button',
      tabindex: 0,
      'aria-label': `Rondje ${i + 1}: ${cell === null ? 'leeg' : cell === 'skull' ? 'doodshoofd' : cell}`,
    });
    if (target) {
      const preview = resultFor(m, i, value);
      g.append(svg('circle', { cx: p.x, cy: p.y, r: r - 4, class: 't12-glow' }));
      g.append(
        svg('text', { x: p.x, y: p.y, class: `t12-ghost${preview === 'skull' ? ' skull' : ''}` }, preview === 'skull' ? '☹' : String(preview)),
      );
    }
    if (selected) g.append(svg('circle', { cx: p.x, cy: p.y, r: r + 5, class: 't12-sel' }));
    if (typeof cell === 'number') {
      g.append(svg('text', { x: p.x, y: p.y, class: `t12-num${orphanSet.has(i) ? ' orphan' : ''}` }, String(cell)));
      if (orphanSet.has(i)) g.append(svg('text', { x: p.x + r * 0.62, y: p.y + r * 0.6, class: 't12-orphan' }, '☹'));
    } else if (cell === 'skull') {
      g.append(svg('text', { x: p.x, y: p.y, class: 't12-skull' }, '☹'));
    }
    g.append(svg('circle', { cx: p.x, cy: p.y, r, class: 't12-tap' }));

    const activate = (): void => onSpot(m, s, i, g);
    g.addEventListener('click', activate);
    g.addEventListener('keydown', (e) => {
      if ((e as KeyboardEvent).key === 'Enter' || (e as KeyboardEvent).key === ' ') {
        e.preventDefault();
        activate();
      }
    });
    marks.append(g);
  });
  root.append(marks);

  const wrap = h('div', { class: 't12-map-wrap' });
  wrap.append(root);
  return wrap;
}

function onSpot(m: Mountain, s: TrekState, i: number, el: Element): void {
  const cell = s.sheet.cells[i];
  if (s.phase === 'score') {
    if (typeof cell !== 'number') {
      shake(el);
      toast(cell === 'skull' ? 'Een doodshoofd hoort nergens bij' : 'Dit rondje is leeg');
      return;
    }
    selection = selection.includes(i) ? selection.filter((c) => c !== i) : [...selection, i];
    render();
    return;
  }

  if (cell !== null) {
    toast('Vergist? Gebruik de knop ↶ om terug te gaan');
    return;
  }
  if (s.roll.red === null || s.roll.yellow === null) {
    shake(el);
    toast('Kies eerst de rode en gele dobbelsteen');
    return;
  }
  if (!s.op) {
    shake(el);
    toast('Kies eerst een uitkomst: laagste, hoogste, verschil, som of product');
    return;
  }
  if (!canPlace(m, s.sheet, i)) {
    shake(el);
    toast('Kies een rondje dat grenst aan een getal dat er al staat');
    return;
  }
  const value = opValue(s.op, s.roll.red, s.roll.yellow);
  const sheet = place(m, s.sheet, i, s.op, value);
  const full = filledCount(sheet) === m.spots.length;
  if (sheet.cells[i] === 'skull') toast(`${value} past niet: doodshoofd (−3)`);
  if (full) {
    selection = [];
    toast('Berg vol! Tik nu rondjes aan om lijnen en zones te maken.', 4000);
  }
  apply(s, { sheet, roll: { red: null, yellow: null }, op: null, phase: full ? 'score' : 'play' });
}

/* ---------- Invullen: dobbelstenen en uitkomsten ---------- */

function playPanel(m: Mountain, s: TrekState): HTMLElement {
  const round = Math.min(filledCount(s.sheet) + 1, m.spots.length);
  const haveRoll = s.roll.red !== null && s.roll.yellow !== null;

  const dieRow = (color: 'red' | 'yellow', faces: number[]): HTMLElement =>
    h(
      'div',
      { class: 't12-die-row', role: 'group', 'aria-label': color === 'red' ? 'Rode dobbelsteen' : 'Gele dobbelsteen' },
      faces.map((n) =>
        h(
          'button',
          {
            type: 'button',
            class: `t12-die ${color}${s.roll[color] === n ? ' on' : ''}`,
            'aria-pressed': String(s.roll[color] === n),
            onclick: () => apply(s, { roll: { ...s.roll, [color]: s.roll[color] === n ? null : n } }, false),
          },
          String(n),
        ),
      ),
    );

  const rollButton = h(
    'button',
    {
      type: 'button',
      class: 't12-roll',
      onclick: () => {
        const red = RED_FACES[Math.floor(Math.random() * 6)] as number;
        const yellow = YELLOW_FACES[Math.floor(Math.random() * 6)] as number;
        apply(s, { roll: { red, yellow }, op: null }, false);
      },
    },
    '🎲 Gooien',
  );

  const ops = h(
    'div',
    { class: 't12-ops' },
    OPS.map((o) => {
      const used = s.sheet.ticks[o.key];
      const fullOp = used >= TICKS_PER_OP;
      const v = haveRoll ? opValue(o.key, s.roll.red as number, s.roll.yellow as number) : null;
      const tooHigh = v !== null && v > 12;
      return h(
        'button',
        {
          type: 'button',
          class: `t12-op${s.op === o.key ? ' on' : ''}${tooHigh ? ' high' : ''}`,
          disabled: fullOp || !haveRoll,
          'aria-pressed': String(s.op === o.key),
          'aria-label': `${o.name}${v !== null ? ` = ${v}` : ''}, ${TICKS_PER_OP - used} over`,
          onclick: () => apply(s, { op: s.op === o.key ? null : o.key }, false),
        },
        h('span', { class: 't12-op-sym' }, o.symbol),
        h('span', { class: 't12-op-name' }, o.name),
        h('span', { class: 't12-op-val' }, v === null ? '' : tooHigh ? `${v} ☹` : String(v)),
        h(
          'span',
          { class: 't12-ticks', 'aria-hidden': 'true' },
          Array.from({ length: TICKS_PER_OP }, (_, k) => h('i', { class: k < used ? 'used' : '' })),
        ),
      );
    }),
  );

  const hint = !haveRoll
    ? 'Kies de rode en gele steen, of laat de app gooien.'
    : !s.op
      ? 'Kies een uitkomst.'
      : 'Tik een oplichtend rondje op de berg.';

  return h(
    'div',
    { class: 't12-panel' },
    h('div', { class: 't12-round' }, h('strong', null, `Worp ${round}`), h('span', { class: 'muted' }, ` van ${m.spots.length}`)),
    h('div', { class: 't12-dice' }, dieRow('red', RED_FACES), dieRow('yellow', YELLOW_FACES), rollButton),
    ops,
    h('p', { class: 't12-hint muted' }, hint),
  );
}

/* ---------- Telling: lijnen en zones tekenen ---------- */

function describeGroup(s: Sheet, g: Group): string {
  const nums = (g.kind === 'line' ? lineOrder(s, g.cells) : g.cells).map((c) => s.cells[c]);
  return g.kind === 'line' ? nums.join('-') : `${g.cells.length}× ${nums[0]}`;
}

function groupPanel(m: Mountain, s: TrekState, full: boolean): HTMLElement {
  const check = selection.length > 0 ? checkGroup(m, s.sheet, selection) : null;
  const lines = s.sheet.groups.map((g, idx) => ({ g, idx })).filter((x) => x.g.kind === 'line');
  const zones = s.sheet.groups.map((g, idx) => ({ g, idx })).filter((x) => x.g.kind === 'zone');
  const orphanCount = orphans(s.sheet).length;

  const groupList = (title: string, items: { g: Group; idx: number }[], kind: 'line' | 'zone'): HTMLElement =>
    h(
      'div',
      { class: `t12-glist ${kind}` },
      h('h3', null, title),
      items.length === 0
        ? h('p', { class: 'muted' }, kind === 'line' ? 'Nog geen lijnen.' : 'Nog geen zones.')
        : h(
            'ul',
            null,
            items.map(({ g, idx }) =>
              h(
                'li',
                null,
                h('span', { class: 't12-gname' }, describeGroup(s.sheet, g)),
                h('b', null, `${groupPoints(s.sheet, g)}`),
                h(
                  'button',
                  {
                    type: 'button',
                    class: 'btn-ghost',
                    'aria-label': 'Groep verwijderen',
                    onclick: () => apply(s, { sheet: { ...s.sheet, groups: s.sheet.groups.filter((_, k) => k !== idx) } }),
                  },
                  '✕',
                ),
              ),
            ),
          ),
    );

  const makeButton = h(
    'button',
    {
      type: 'button',
      class: `btn-primary t12-make${check?.ok ? ` ${check.kind}` : ''}`,
      disabled: !check?.ok,
      onclick: () => {
        if (!check?.ok) return;
        const groups = [...s.sheet.groups, { kind: check.kind, cells: [...selection] }];
        selection = [];
        apply(s, { sheet: { ...s.sheet, groups } });
      },
    },
    check?.ok ? `${check.kind === 'line' ? 'Lijn' : 'Zone'} maken · ${check.points} pt` : 'Lijn of zone maken',
  );

  return h(
    'div',
    { class: 't12-panel' },
    h(
      'div',
      { class: 't12-select' },
      h(
        'p',
        { class: check && !check.ok ? 't12-warn' : 'muted' },
        selection.length === 0
          ? 'Tik rondjes aan: opeenvolgende getallen voor een lijn, gelijke getallen voor een zone.'
          : check && !check.ok
            ? check.reason
            : `${selection.length} rondjes gekozen.`,
      ),
      h(
        'div',
        { class: 'row stretch' },
        selection.length > 0
          ? h(
              'button',
              {
                type: 'button',
                class: 'btn-ghost t12-clear-sel',
                onclick: () => {
                  selection = [];
                  render();
                },
              },
              'Wissen',
            )
          : null,
        makeButton,
      ),
    ),
    groupList('Lijnen', lines, 'line'),
    groupList('Zones', zones, 'zone'),
    orphanCount > 0
      ? h('p', { class: 't12-orphans' }, `☹ ${orphanCount} los${orphanCount === 1 ? ' rondje' : 'se rondjes'}: elk −3`)
      : null,
    h(
      'div',
      { class: 't12-cards' },
      h('span', null, 'Ongebruikte hulpkaarten', h('small', { class: 'muted' }, ' (expeditie, +3 per stuk)')),
      h(
        'div',
        { class: 't12-stepper' },
        h(
          'button',
          { type: 'button', disabled: s.sheet.cards <= 0, onclick: () => apply(s, { sheet: { ...s.sheet, cards: s.sheet.cards - 1 } }), 'aria-label': 'Minder' },
          '−',
        ),
        h('b', null, String(s.sheet.cards)),
        h(
          'button',
          { type: 'button', disabled: s.sheet.cards >= MAX_CARDS, onclick: () => apply(s, { sheet: { ...s.sheet, cards: s.sheet.cards + 1 } }), 'aria-label': 'Meer' },
          '+',
        ),
      ),
    ),
    !full
      ? h(
          'button',
          {
            type: 'button',
            class: 'btn-ghost t12-back',
            onclick: () => {
              selection = [];
              apply(s, { phase: 'play' });
            },
          },
          '‹ Terug naar invullen',
        )
      : null,
  );
}

/* ---------- Telbalk, in de stijl van het blad ---------- */

function scoreBar(m: Mountain, s: TrekState): HTMLElement {
  const sc = score(m, s.sheet, s.phase === 'score');
  const record = readJSON<number | null>(recordKey(m.id), null);
  const boxes = (values: number[]): HTMLElement[] => {
    const n = Math.max(8, values.length);
    return Array.from({ length: n }, (_, k) => h('span', { class: 't12-box' }, values[k] !== undefined ? String(values[k]) : ''));
  };
  const row = (label: string, kind: string, values: number[], bonus: number, total: number): HTMLElement =>
    h(
      'div',
      { class: `t12-srow ${kind}` },
      h('span', { class: 't12-sicon', title: label, 'aria-label': label }),
      h('span', { class: 't12-boxes' }, boxes(values)),
      h('span', { class: 't12-op-s' }, '+'),
      h('span', { class: 't12-box bonus', title: 'Bonus' }, bonus ? String(bonus) : ''),
      h('span', { class: 't12-op-s' }, '='),
      h('span', { class: 't12-box sum' }, String(total)),
    );

  const summit = sc.total >= m.summit;
  const newRecord = s.phase === 'score' && sc.total > 0 && (record === null || sc.total > record);

  return h(
    'div',
    { class: 't12-paper' },
    h(
      'div',
      { class: 't12-paper-head' },
      h('span', { class: 't12-title' }, m.name),
      h(
        'span',
        { class: 't12-stars' },
        h('span', { class: `t12-star${summit ? ' on' : ''}`, title: `Top: ${m.summit}+ punten` }, `${m.summit}+ `, summit ? '★' : '☆'),
        h('span', { class: `t12-star${newRecord ? ' on' : ''}`, title: record !== null ? `Record: ${record}` : 'Nog geen record' }, `🏆 ${record ?? '–'} `, newRecord ? '★' : '☆'),
      ),
      h(
        'span',
        { class: 't12-bonus-table', title: 'Bonus voor langste lijn en grootste zone' },
        m.bonus.slice(3).map((b, k) => h('span', null, h('i', null, String(k + 3)), h('b', null, String(b)))),
        h('span', null, h('i', null, '+1'), h('b', null, `+${m.bonusExtra}`)),
      ),
    ),
    h(
      'div',
      { class: 't12-paper-body' },
      h('div', { class: 't12-rows' }, row('Lijnen', 'line', sc.lines, sc.lineBonus, sc.lineTotal), row('Zones', 'zone', sc.zones, sc.zoneBonus, sc.zoneTotal)),
      h(
        'div',
        { class: 't12-final' },
        h('span', { class: 't12-mini', title: 'Hulpkaarten' }, h('i', null, '+🃏'), h('b', null, String(sc.cards))),
        h('span', { class: 't12-mini minus', title: 'Doodshoofden en losse rondjes' }, h('i', null, '−☹'), h('b', null, String(sc.penalty))),
        h('span', { class: 't12-total', title: 'Totaal' }, fmt(sc.total)),
      ),
    ),
  );
}

/* ------------------------------------------------------------------ */
/* Afronden                                                            */
/* ------------------------------------------------------------------ */

function finishGame(m: Mountain, s: TrekState): void {
  const sc = score(m, s.sheet);
  const extra = sc.orphans > 0 ? `\n${sc.orphans} losse rondjes tellen als doodshoofd.` : '';
  if (!confirm(`Berg afronden met ${fmt(sc.total)} punten en opslaan bij "Gespeeld"?${extra}`)) return;
  const name = s.player || 'Ik';
  const record = readJSON<number | null>(recordKey(m.id), null);
  const isRecord = record === null || sc.total > record;
  if (isRecord) writeJSON(recordKey(m.id), sc.total);
  addHistory({ gameId: GAME_ID, title: `Trek 12 · ${m.name}`, players: [{ name, score: sc.total }], winners: [name] });
  store.clear();
  state = null;
  selection = [];
  render();
  if (sc.total >= m.summit || isRecord) confetti();
  const msgs = [`${fmt(sc.total)} punten opgeslagen`];
  if (sc.total >= m.summit) msgs.push('top bereikt ⭐');
  if (isRecord && record !== null) msgs.push('nieuw record 🏆');
  toast(msgs.join(' · '), 4000);
}

function clearGame(): void {
  if (!confirm('Berg wissen zonder op te slaan?')) return;
  store.clear();
  state = null;
  selection = [];
  render();
}

render();
