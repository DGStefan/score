import { h, toast } from '@shared/dom';
import { readJSON, writeJSON } from '@shared/storage';
import { ROUNDS } from './data';
import boardUrl from './prikbord.webp';

/**
 * Het prikbord: de "draaischijf" met de zeven actiebriefjes en de rondeteller.
 * Eén tablet midden op tafel: worp invoeren of gooien, de app legt de stenen
 * gesorteerd op de briefjes, schuift boerin Edith door en houdt de ronde bij.
 */

export type SpaceId = 'apiaryGold' | 'plant' | 'shedA' | 'goods' | 'apiaryBlue' | 'shedB' | 'market';

export interface Space {
  id: SpaceId;
  name: string;
  icon: string;
  pin?: 'gold' | 'blue';
}

/** Met de klok mee, beginnend bij het briefje met de gouden punaise. */
export const RONDEL: Space[] = [
  { id: 'apiaryGold', name: 'Bijen of fruit', icon: '🐝', pin: 'gold' },
  { id: 'plant', name: 'Planten of water', icon: '💧' },
  { id: 'shedA', name: 'Schuurtijd', icon: '✂️' },
  { id: 'goods', name: '1 compost + 4 goederen', icon: '📦' },
  { id: 'apiaryBlue', name: 'Bijen of fruit', icon: '🐝', pin: 'blue' },
  { id: 'shedB', name: 'Schuurtijd', icon: '🚜' },
  { id: 'market', name: 'Markt', icon: '🧺' },
];

/** Plek van de stenen en van Edith op de prikbord-afbeelding (1615 × 974). */
const BOARD_W = 1615;
const BOARD_H = 974;
const SPOT: Record<SpaceId, { dice: [number, number]; edith: [number, number] }> = {
  plant: { dice: [245, 300], edith: [140, 190] },
  shedA: { dice: [545, 395], edith: [440, 210] },
  goods: { dice: [770, 430], edith: [650, 150] },
  apiaryBlue: { dice: [1030, 300], edith: [880, 285] },
  shedB: { dice: [835, 760], edith: [720, 565] },
  market: { dice: [560, 650], edith: [400, 600] },
  apiaryGold: { dice: [255, 790], edith: [140, 540] },
};
/** Middelpunt van de rondevakjes op de afbeelding. */
const ROUND_BOX: [number, number][] = [
  [1062, 617], [1190, 629], [1320, 632], [1449, 648],
  [1055, 733], [1184, 746], [1312, 758], [1442, 772],
];
const pct = ([x, y]: [number, number]): string => `left:${(x / BOARD_W) * 100}%;top:${(y / BOARD_H) * 100}%`;

export type EventKind = 'shed' | 'rain' | 'market';
export const EVENTS: EventKind[] = ['shed', 'rain', 'market', 'rain', 'market', 'shed', 'market', 'rain'];
export const EVENT_LABEL: Record<EventKind, string> = { shed: '🧰 Schuur', rain: '🌧️ Regen', market: '🧺 Markt' };

const DICE_FOR: Record<number, number> = { 1: 4, 2: 4, 3: 5, 4: 6 };

interface Die {
  value: number;
  space: number;
  taken: boolean;
}

export interface TableState {
  players: number;
  edith: number;
  dice: Die[];
  /** Worp die nog wordt ingevoerd (voor het leggen). */
  entry: number[];
}

const KEY = 'spel:three-sisters:tafel';

function load(): TableState {
  return readJSON<TableState>(KEY, { players: 2, edith: 0, dice: [], entry: [] });
}

function save(t: TableState): void {
  writeJSON(KEY, t);
}

export function resetTable(): void {
  const t = load();
  save({ players: t.players, edith: 0, dice: [], entry: [] });
}

/** Stenen groeperen per waarde en op de briefjes leggen vanaf Edith; Edith schuift door. */
function place(t: TableState, values: number[]): TableState {
  const groups = [...new Set(values)].sort((a, b) => a - b);
  const dice: Die[] = [];
  groups.forEach((v, k) => {
    const space = (t.edith + k) % RONDEL.length;
    values.filter((x) => x === v).forEach(() => dice.push({ value: v, space, taken: false }));
  });
  return { ...t, dice, entry: [], edith: (t.edith + groups.length) % RONDEL.length };
}

const PIPS: Record<number, number[]> = { 2: [0, 8], 3: [0, 4, 8], 4: [0, 2, 6, 8], 5: [0, 2, 4, 6, 8], 6: [0, 2, 3, 5, 6, 8] };

function dieFace(value: number, cls = ''): HTMLElement {
  if (value === 1) return h('span', { class: `tt-die one ${cls}`, 'aria-label': '1' }, '🎃');
  return h(
    'span',
    { class: `tt-die ${cls}`, 'aria-label': String(value) },
    Array.from({ length: 9 }, (_, i) => h('i', { class: PIPS[value]?.includes(i) ? 'on' : '' })),
  );
}

export interface TableHooks {
  round: () => number;
  setRound: (r: number) => void;
  /** Neem een steen voor je eigen blad: tuinactie in zone `value` + actie van het briefje. */
  takeForMe: (value: number, space: SpaceId) => void;
  /** Gebeurtenis van de ronde op je eigen blad uitvoeren. */
  event: (e: EventKind) => void;
}

export function openTable(hooks: TableHooks): void {
  let t = load();
  const dialog = h('dialog', { class: 'tt-dialog', 'aria-label': 'Prikbord' });
  const body = h('div', { class: 'tt-body' });

  const update = (next: TableState): void => {
    t = next;
    save(t);
    paint();
  };

  const paint = (): void => {
    const round = hooks.round();
    const ev = EVENTS[round - 1] ?? 'rain';
    const remaining = t.dice.filter((d) => !d.taken);
    const takenCount = t.dice.length - remaining.length;
    const allChose = t.dice.length > 0 && takenCount >= t.players;
    const lowest = remaining.length ? Math.min(...remaining.map((d) => d.value)) : null;
    const lowestIdx = allChose && lowest !== null ? t.dice.findIndex((d) => !d.taken && d.value === lowest) : -1;
    const need = DICE_FOR[t.players] ?? 4;

    /* --- Prikbord: de afbeelding met de stenen erop --- */
    const board = h('div', { class: 'tt-board' }, h('img', { src: boardUrl, alt: 'Prikbord', width: BOARD_W, height: BOARD_H, draggable: false }));
    RONDEL.forEach((sp, idx) => {
      const spot = SPOT[sp.id];
      const here = t.dice.map((d, i) => ({ d, i })).filter((x) => x.d.space === idx);
      if (t.edith === idx) board.append(h('span', { class: 'tt-edith', style: pct(spot.edith), title: 'Boerin Edith' }, '👩‍🌾'));
      if (here.length === 0) return;
      board.append(
        h(
          'span',
          { class: 'tt-dice', style: pct(spot.dice) },
          here.map(({ d, i }) =>
            h(
              'button',
              {
                type: 'button',
                class: `tt-diebtn${d.taken ? ' taken' : ''}${i === lowestIdx ? ' lowest' : ''}`,
                'aria-label': `Steen ${d.value} op ${sp.name}${d.taken ? ' (genomen)' : ''}`,
                onclick: () => chooseDie(i),
              },
              dieFace(d.value),
            ),
          ),
        ),
      );
    });
    ROUND_BOX.forEach((pos, k) => {
      board.append(
        h('button', {
          type: 'button',
          class: `tt-roundspot${k + 1 === round ? ' now' : ''}${k + 1 < round ? ' past' : ''}`,
          style: pct(pos),
          'aria-label': `Ronde ${k + 1}`,
          onclick: () => {
            hooks.setRound(k + 1);
            paint();
          },
        }),
      );
    });

    /* --- Rondes --- */
    const rounds = h(
      'div',
      { class: 'tt-rounds' },
      EVENTS.map((e, k) =>
        h(
          'button',
          {
            type: 'button',
            class: `tt-round${k + 1 === round ? ' now' : ''}${k + 1 < round ? ' past' : ''}`,
            onclick: () => {
              hooks.setRound(k + 1);
              paint();
            },
            'aria-label': `Ronde ${k + 1}: ${EVENT_LABEL[e]}`,
          },
          h('b', null, String(k + 1)),
          h('small', null, EVENT_LABEL[e]),
        ),
      ),
    );

    /* --- Worp invoeren --- */
    const entry = h(
      'div',
      { class: 'tt-entry' },
      h(
        'div',
        { class: 'tt-entry-head' },
        h('b', null, t.dice.length ? 'Volgende worp' : 'Worp'),
        h(
          'span',
          { class: 'tt-players' },
          'Spelers ',
          [1, 2, 3, 4].map((n) =>
            h(
              'button',
              { type: 'button', class: n === t.players ? 'on' : '', onclick: () => update({ ...t, players: n, entry: t.entry.slice(0, DICE_FOR[n] ?? 4) }) },
              String(n),
            ),
          ),
          h('small', null, ` · ${need} stenen`),
        ),
      ),
      h(
        'div',
        { class: 'tt-pad' },
        [1, 2, 3, 4, 5, 6].map((v) =>
          h(
            'button',
            {
              type: 'button',
              disabled: t.entry.length >= need,
              onclick: () => update({ ...t, entry: [...t.entry, v] }),
              'aria-label': `Steen ${v}`,
            },
            dieFace(v),
          ),
        ),
      ),
      h(
        'div',
        { class: 'tt-entry-row' },
        h(
          'span',
          { class: 'tt-entered' },
          t.entry.length ? t.entry.map((v) => dieFace(v, 'small')) : h('small', { class: 'muted' }, 'Tik de gegooide stenen in, of laat de app gooien.'),
        ),
        t.entry.length ? h('button', { type: 'button', class: 'btn-ghost', onclick: () => update({ ...t, entry: [] }) }, 'Wis') : null,
      ),
      h(
        'div',
        { class: 'tt-entry-row' },
        h(
          'button',
          {
            type: 'button',
            onclick: () => update(place(t, Array.from({ length: need }, () => 1 + Math.floor(Math.random() * 6)))),
          },
          '🎲 Gooien',
        ),
        h(
          'button',
          { type: 'button', class: 'btn-primary', disabled: t.entry.length !== need, onclick: () => update(place(t, t.entry)) },
          `Op het bord leggen (${t.entry.length}/${need})`,
        ),
      ),
    );

    /* --- Status --- */
    const hint =
      t.dice.length === 0
        ? 'Gooi de stenen; de app legt ze op volgorde vanaf Edith (👩‍🌾).'
        : !allChose
          ? `Om de beurt neemt iedereen een steen (${takenCount}/${t.players}). Tik een steen om hem te nemen.`
          : lowestIdx >= 0
            ? `Iedereen gebruikt nu samen de laagste steen (${lowest}, gemarkeerd). Daarna: gebeurtenis ${EVENT_LABEL[ev]}.`
            : `Gebeurtenis van ronde ${round}: ${EVENT_LABEL[ev]}.`;

    body.replaceChildren(
      h('p', { class: 'tt-hint' }, hint),
      h('div', { class: 'tt-boardwrap' }, board),
      h(
        'div',
        { class: 'tt-bottom' },
        rounds,
        h(
          'div',
          { class: 'tt-actions' },
          h('button', { type: 'button', onclick: () => hooks.event(ev) }, `${EVENT_LABEL[ev]} op mijn blad`),
          h(
            'button',
            {
              type: 'button',
              class: 'btn-primary',
              disabled: round >= ROUNDS,
              onclick: () => {
                hooks.setRound(Math.min(ROUNDS, round + 1));
                update({ ...t, dice: [], entry: [] });
                toast(`Ronde ${Math.min(ROUNDS, round + 1)}: ${EVENT_LABEL[EVENTS[round] ?? 'rain']}. Startspeler schuift door.`, 3500);
              },
            },
            'Volgende ronde ›',
          ),
        ),
      ),
      entry,
      h(
        'p',
        { class: 'tt-download muted' },
        'Liever op papier? ',
        h('a', { href: '../../downloads/three-sisters-prikbord.pdf', download: '' }, 'Download het prikbord (A4, PDF)'),
        ' en leg de echte stenen erop.',
      ),
    );
  };

  /** Steen aantikken: nemen / terugleggen, en eventueel meteen op je eigen blad gebruiken. */
  const chooseDie = (i: number): void => {
    const d = t.dice[i];
    if (!d) return;
    const sp = RONDEL[d.space];
    if (!sp) return;
    if (d.taken) {
      update({ ...t, dice: t.dice.map((x, k) => (k === i ? { ...x, taken: false } : x)) });
      return;
    }
    const pick = h(
      'div',
      { class: 'tt-pick' },
      h('p', null, h('b', null, `Steen ${d.value}`), ` · zone ${d.value} + ${sp.icon} ${sp.name}`),
      h(
        'div',
        { class: 'row stretch' },
        h('button', { type: 'button', onclick: () => (pick.remove(), mark()) }, 'Genomen door een ander'),
        h(
          'button',
          {
            type: 'button',
            class: 'btn-primary',
            onclick: () => {
              pick.remove();
              mark();
              hooks.takeForMe(d.value, sp.id);
            },
          },
          'Ik neem hem',
        ),
      ),
      h('button', { type: 'button', class: 'btn-ghost', onclick: () => pick.remove() }, 'Annuleren'),
    );
    const mark = (): void => update({ ...t, dice: t.dice.map((x, k) => (k === i ? { ...x, taken: true } : x)) });
    body.querySelector('.tt-pick')?.remove();
    body.prepend(pick);
  };

  dialog.append(
    h(
      'div',
      { class: 'rules-head' },
      h('h2', null, '📌 Prikbord'),
      h('button', { type: 'button', class: 'btn-ghost', 'aria-label': 'Sluiten', onclick: () => dialog.close() }, '✕'),
    ),
    body,
  );
  dialog.addEventListener('close', () => dialog.remove());
  document.body.append(dialog);
  paint();
  dialog.showModal();
}
