import { confetti } from '@shared/confetti';
import { dicePanel, type DieFace, type DieSpec } from '@shared/dice';
import { h, mount, toast } from '@shared/dom';
import { addHistory } from '@shared/history';
import { initPage } from '@shared/page';
import { getRecentPlayers, rememberPlayers } from '@shared/players';
import { rulesButton } from '@shared/rules';
import { sessionStore } from '@shared/session';
import { readJSON, writeJSON } from '@shared/storage';
import '../keer-op-keer/keer-op-keer.css';
import { COLOR_ORDER, colorsFor, type ColorKey } from '../keer-op-keer/layouts';
import { canCross, cellsOf, colorProgress, isColumnComplete } from '../keer-op-keer/scoring';
import './kok3.css';
import {
  BOMB_CELLS,
  COLUMN_BONUS,
  CROSSINGS,
  CROSSINGS_PER_ROMAN,
  DIAMOND_BONUS,
  DIAMONDS_PER_ROW,
  JOKER_SLOTS,
  LAYOUT3,
  PASS_BONUS,
  PASS_END,
  PASS_FIELDS,
  ROW_LABELS,
  X_CHIPS,
  crossingCounts,
  crossingDone,
  diamondsCrossed,
  emptySheet3,
  isRowComplete,
  status,
  toggleTaken,
  type Bonus,
  type Sheet3,
} from './model';
import { KOK3_RULES } from './rules';

/**
 * Keer op Keer 3: je eigen blad op je eigen scherm.
 * Jij kruist aan; de app bewaakt de aansluitregel, ziet welke bonussen je haalt
 * en houdt je X-chips, jokers, ruitjes, kruispunten en pas-balk bij.
 */

const GAME_ID = 'keer-op-keer-3';
const VERSION = 1;
const MAX_UNDO = 150;

interface Kok3State extends Sheet3 {
  version: typeof VERSION;
  player: string;
  undo: Sheet3[];
}

const UNDO_SVG =
  '<svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M9 14 4 9l5-5"/><path d="M4 9h10.5a5.5 5.5 0 0 1 0 11H11"/></svg>';
const DIAMOND_SVG =
  '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 3h12l4 6-10 12L2 9z" fill="currentColor" opacity=".9"/><path d="M2 9h20M9 3 7.5 9 12 21l4.5-12L15 3" fill="none" stroke="rgba(0,0,0,.18)" stroke-width="1.2"/></svg>';

const ICON: Record<Bonus, string> = { x: '✕', joker: '!', pass: '◇', bomb: '💣', block: '▦', row3: '→' };
const BONUS_NAME: Record<Bonus, string> = {
  x: 'X-chip inleveren',
  joker: 'joker vrijspelen',
  pass: 'vakje op de pas-balk',
  bomb: 'bom',
  block: 'kleurblok',
  row3: 'drie op een rij',
};

const store = sessionStore<Kok3State>(GAME_ID, VERSION);
const LAST_KEY = `spel:${GAME_ID}:speler`;

initPage({ root: '../../', keepAwake: true });

const app = mount('#app');
let state: Kok3State | null = store.load();

function sheetOf(s: Kok3State): Sheet3 {
  const { version: _v, player: _p, undo: _u, ...sheet } = s;
  return sheet;
}

function render(): void {
  const left = app.querySelector<HTMLElement>('.kok-sheet-wrap')?.scrollLeft ?? 0;
  app.classList.toggle('kok-wide', Boolean(state));
  app.replaceChildren(state ? playView(state) : setupView());
  const wrap = app.querySelector<HTMLElement>('.kok-sheet-wrap');
  if (wrap) wrap.scrollLeft = left;
}

/** Nieuw blad opslaan en nieuwe bonussen melden. */
function apply(s: Kok3State, next: Sheet3): void {
  const prev = sheetOf(s);
  state = { ...s, ...next, undo: [...s.undo, prev].slice(-MAX_UNDO) };
  store.save(state);
  render();

  const before = status(prev);
  const after = status(next);
  const old = new Set(before.earned.map((e) => e.key));
  const fresh = after.earned.filter((e) => !old.has(e.key));
  const messages: string[] = [];
  for (const e of fresh) {
    if (e.bonus === 'x') continue;
    if (e.bonus === 'block') messages.push(`▦ ${e.label}: kruis nu een heel kleurblok aan (aansluitend).`);
    else if (e.bonus === 'row3') messages.push(`→ ${e.label}: kruis nu tot 3 vakjes in één rij aan, elk aansluitend.`);
    else if (e.bonus === 'joker') messages.push(`! ${e.label}: joker vrijgespeeld.`);
    else if (e.bonus === 'pass') messages.push(`◇ ${e.label}: vakje op je pas-balk.`);
  }
  const newChips = after.chipsDropped - before.chipsDropped;
  if (newChips > 0) {
    const left = X_CHIPS - after.chipsDropped;
    messages.unshift(
      `✕ Draai ${newChips === 1 ? 'je meest linkse X-chip' : `${newChips} X-chips`} om (nog ${left}). Staat er een bonus op? Geef hem aan een andere speler.`,
    );
    confetti();
  }
  if (after.chipsDropped >= X_CHIPS && before.chipsDropped < X_CHIPS) {
    messages.unshift('🏁 Al je X-chips zijn weg! Het spel eindigt na deze worp.');
  }
  if (messages.length) toast(messages.join(' '), 4500);
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
    state = { version: VERSION, player: name, ...emptySheet3(), undo: [] };
    store.save(state);
    render();
    toast('Gooi eerst je startcombinatie en vul hem in bij de pas-balk.', 3500);
  };

  return h(
    'form',
    { onsubmit: start },
    h('div', { class: 'topbar' }, h('a', { class: 'btn btn-ghost', href: '../../' }, '‹ Spellen'), h('h1', null, 'Keer op Keer 3'), rulesButton(KOK3_RULES)),
    h(
      'div',
      { class: 'card' },
      h(
        'p',
        { style: 'margin-top:0' },
        'Iedereen houdt zijn eigen blad bij op zijn eigen scherm. Leg je 10 X-chips klaar: wie ze het eerst allemaal kwijt is, wint. Nieuw? Tik op het vraagteken voor de spelregels.',
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
    ),
    h('div', { class: 'actions row stretch' }, h('button', { type: 'submit', class: 'btn-primary btn-big' }, 'Start')),
  );
}

function shake(el: HTMLElement): void {
  el.classList.remove('shake');
  void el.offsetWidth;
  el.classList.add('shake');
}

/* ------------------------------------------------------------------ */
/* Blad                                                                */
/* ------------------------------------------------------------------ */

/** Bonusvakje: roze rand = alleen de eerste (tik om door te strepen), wit = iedereen. */
function bonusBox(s: Kok3State, sheet: Sheet3, bonus: Bonus | null, opts: { key: string; first: boolean; won: boolean; label: string }): HTMLElement {
  if (!bonus) return h('span', { class: 'kok3-bonus empty' });
  const taken = opts.first && Boolean(sheet.taken[opts.key]);
  const cls = `kok3-bonus b-${bonus}${opts.first ? ' first' : ' white'}${opts.won && !taken ? ' won' : ''}${taken ? ' taken' : ''}`;
  const aria = `${opts.label}: ${BONUS_NAME[bonus]}${opts.first ? ' (alleen de eerste)' : ''}${taken ? ', een ander was eerder' : ''}`;
  if (!opts.first) return h('span', { class: cls, title: aria, 'aria-label': aria }, ICON[bonus]);
  return h(
    'button',
    {
      type: 'button',
      class: cls,
      title: taken ? 'Een ander was eerder (tik om terug te zetten)' : 'Tik als een ander dit eerder had',
      'aria-label': aria,
      onclick: () => apply(s, toggleTaken(sheet, opts.key)),
    },
    ICON[bonus],
  );
}

function playView(s: Kok3State): HTMLElement {
  const layout = LAYOUT3;
  const sheet = sheetOf(s);
  const colors = colorsFor(layout);
  const cells = cellsOf(layout);
  const st = status(sheet);
  const H = layout.startColumn;

  /* --- Raster: [✕] A..O [letter], daaronder 2 rijen kolombonussen --- */
  const grid = h('div', { class: 'kok-sheet kok3-sheet' });
  const spacer = (): HTMLElement => h('span', { class: 'kok3-spacer' });

  grid.append(spacer());
  layout.columnLabels.forEach((label, col) =>
    grid.append(h('div', { class: `kok-head${col === H ? ' start' : ''}${isColumnComplete(layout, sheet, col) ? ' complete' : ''}` }, label)),
  );
  grid.append(spacer());

  ROW_LABELS.forEach((label, r) => {
    grid.append(bonusBox(s, sheet, 'x', { key: `rij-${r}`, first: false, won: isRowComplete(sheet, r), label: `Rij ${label}` }));
    cells
      .filter((c) => c.row === r)
      .forEach((cell) => {
        const info = colors[cell.color];
        const crossed = Boolean(sheet.crossed[cell.index]);
        const free = sheet.freeCrosses > 0;
        const reachable = free || canCross(layout, sheet, cell);
        const crossing = CROSSINGS.find((p) => p.row === cell.row && p.col === cell.col);
        grid.append(
          h(
            'button',
            {
              type: 'button',
              class: `kok-cell${cell.col === H ? ' start' : ''}${crossed ? ' crossed' : ''}${!crossed && !reachable ? ' blocked' : ''}${free && !crossed ? ' bomb-target' : ''}`,
              style: `--fill:${info.fill};--ink:${info.ink}`,
              'aria-label': `${layout.columnLabels[cell.col] ?? ''}${label} ${info.name}${cell.star ? ' ruitje' : ''}`,
              onclick: (e: Event) => {
                const next = [...sheet.crossed];
                if (crossed) {
                  next[cell.index] = false;
                  apply(s, { ...sheet, crossed: next });
                  return;
                }
                if (!reachable) {
                  shake(e.currentTarget as HTMLElement);
                  toast('Kruis aansluitend op een ander kruisje, of in kolom H');
                  return;
                }
                next[cell.index] = true;
                apply(s, { ...sheet, crossed: next, freeCrosses: free ? sheet.freeCrosses - 1 : 0 });
              },
            },
            cell.star ? h('span', { class: 'kok3-diamond', innerHTML: DIAMOND_SVG }) : null,
            crossing
              ? h(
                  'span',
                  { class: `kok3-crossing${crossingDone(sheet, crossing) ? ' done' : ''}`, 'aria-hidden': 'true' },
                  'I'.repeat(crossing.roman),
                )
              : null,
          ),
        );
      });
    grid.append(h('div', { class: `kok-head kok3-rowlabel${isRowComplete(sheet, r) ? ' complete' : ''}` }, label));
  });

  ([0, 1] as const).forEach((which) => {
    grid.append(spacer());
    COLUMN_BONUS.forEach((pair, col) => {
      const complete = isColumnComplete(layout, sheet, col);
      grid.append(
        bonusBox(s, sheet, pair[which], {
          key: which === 0 ? `kol-${col}` : `kol-${col}-wit`,
          first: which === 0,
          won: complete,
          label: `Kolom ${layout.columnLabels[col] ?? ''}`,
        }),
      );
    });
    grid.append(spacer());
  });

  /* --- Pas-balk --- */
  const startColor = sheet.startColor ? colors[sheet.startColor] : null;
  const passTrack = h(
    'div',
    { class: 'kok3-pass' },
    h(
      'button',
      {
        type: 'button',
        class: 'kok3-start',
        title: 'Startcombinatie (tik om te kiezen)',
        onclick: () => chooseStart(s, sheet),
      },
      h('span', { class: 'kok3-start-color', style: startColor ? `--fill:${startColor.fill}` : '' }),
      h('span', null, sheet.startNumber ?? '?'),
      h('small', null, startColor ? `${startColor.name} ${sheet.startNumber ?? ''}` : 'Startcombinatie'),
    ),
    h(
      'ol',
      { class: 'kok3-pass-fields' },
      Array.from({ length: PASS_FIELDS }, (_, i) => {
        const filled = i < st.passFilled;
        const bonus = PASS_BONUS[i];
        const end = i === PASS_END;
        const bonusFromPass = st.passFilled - sheet.passManual; // via ◇-bonussen
        return h(
          'li',
          { class: `${bonus || end ? 'dark' : ''}${filled ? ' filled' : ''}` },
          h('button', {
            type: 'button',
            class: 'kok3-pass-field',
            'aria-label': `Pas-balk vakje ${i + 1}${filled ? ' (afgekruist)' : ''}`,
            onclick: () => {
              const manual = filled ? Math.max(0, i - bonusFromPass) : sheet.passManual + (i - st.passFilled + 1);
              apply(s, { ...sheet, passManual: manual });
            },
          }),
          bonus ? h('span', { class: `kok3-pass-bonus${filled ? ' won' : ''}` }, ICON[bonus]) : null,
          end
            ? h(
                'span',
                { class: 'kok3-pass-end' },
                bonusBox(s, sheet, 'x', { key: 'pas-eind', first: true, won: filled, label: 'Einde pas-balk' }),
                bonusBox(s, sheet, 'x', { key: 'pas-eind-wit', first: false, won: filled, label: 'Einde pas-balk' }),
              )
            : null,
        );
      }),
    ),
    h('p', { class: 'kok3-pass-help' }, 'Passen: per overeenkomst met je startcombinatie 1 vakje, minstens 1. Tik het vakje aan.'),
  );

  /* --- Jokers --- */
  const jokerBar = h(
    'div',
    { class: 'kok3-jokers' },
    h('span', { class: 'kok3-joker-label' }, h('b', null, '?'), '/', h('b', null, '✕'), ' ='),
    Array.from({ length: JOKER_SLOTS }, (_, i) => {
      const unlocked = i < st.jokersUnlocked;
      const used = i < sheet.jokersUsed;
      return h(
        'button',
        {
          type: 'button',
          class: `kok3-joker${unlocked ? ' on' : ''}${used ? ' used' : ''}`,
          disabled: !unlocked,
          'aria-label': `Joker ${i + 1}${used ? ' gebruikt' : unlocked ? ' beschikbaar' : ' nog grijs'}`,
          title: used ? 'Gebruikt (tik om terug te zetten)' : unlocked ? 'Tik als je een joker gebruikt' : 'Nog grijs: speel vrij met een !-bonus',
          onclick: () => apply(s, { ...sheet, jokersUsed: used ? i : Math.min(st.jokersUnlocked, sheet.jokersUsed + 1) }),
        },
        '!',
      );
    }),
  );

  /* --- Kleuren --- */
  const progress = colorProgress(layout, sheet);
  const colorBox = h(
    'div',
    { class: 'kok3-box kok3-colors' },
    COLOR_ORDER.map((c) => {
      const { done, total } = progress[c];
      const full = done === total;
      return h(
        'div',
        { class: `kok3-color${full ? ' complete' : ''}` },
        h('span', { class: 'kok3-swatch', style: `--fill:${colors[c].fill}` }, `${done}/${total}`),
        bonusBox(s, sheet, 'x', { key: `kleur-${c}`, first: true, won: full, label: colors[c].name }),
        bonusBox(s, sheet, 'x', { key: `kleur-${c}-wit`, first: false, won: full, label: colors[c].name }),
      );
    }),
  );

  /* --- Ruitjes --- */
  const dia = diamondsCrossed(sheet);
  const diamondBox = h(
    'div',
    { class: 'kok3-box kok3-diamonds' },
    DIAMOND_BONUS.map(([pink, white], k) => {
      const full = dia >= (k + 1) * DIAMONDS_PER_ROW;
      return h(
        'div',
        { class: 'kok3-drow' },
        Array.from({ length: DIAMONDS_PER_ROW }, (_, j) =>
          h('span', { class: `kok3-dslot${k * DIAMONDS_PER_ROW + j < dia ? ' on' : ''}`, innerHTML: DIAMOND_SVG }),
        ),
        bonusBox(s, sheet, pink, { key: `ruit-${k}`, first: true, won: full, label: `Ruitjes rij ${k + 1}` }),
        bonusBox(s, sheet, white, { key: `ruit-${k}-wit`, first: false, won: full, label: `Ruitjes rij ${k + 1}` }),
      );
    }),
  );

  /* --- Kruispunten --- */
  const counts = crossingCounts(sheet);
  const crossingBox = h(
    'div',
    { class: 'kok3-box kok3-crossings' },
    counts.map((n, k) =>
      h(
        'div',
        { class: 'kok3-crow' },
        Array.from({ length: CROSSINGS_PER_ROMAN }, (_, j) => h('span', { class: `kok3-cslot${j < n ? ' on' : ''}` }, 'I'.repeat(k + 1))),
        bonusBox(s, sheet, 'x', { key: `kruis-${k}`, first: true, won: n >= CROSSINGS_PER_ROMAN, label: `Kruispunten ${'I'.repeat(k + 1)}` }),
        bonusBox(s, sheet, 'x', { key: `kruis-${k}-wit`, first: false, won: n >= CROSSINGS_PER_ROMAN, label: `Kruispunten ${'I'.repeat(k + 1)}` }),
      ),
    ),
    h(
      'div',
      { class: 'kok3-crow' },
      Array.from({ length: CROSSINGS_PER_ROMAN }, (_, j) =>
        bonusBox(s, sheet, 'x', { key: `kruiskol-${j}`, first: false, won: counts.every((n) => n > j), label: 'Kruispunten I+II+III' }),
      ),
    ),
  );

  /* --- X-chips --- */
  const left = X_CHIPS - st.chipsDropped;
  const chipBox = h(
    'div',
    { class: 'kok3-box kok3-chips' },
    h('div', { class: 'kok3-chip-row' }, Array.from({ length: X_CHIPS }, (_, i) => h('span', { class: `kok3-chip${i < st.chipsDropped ? ' gone' : ''}` }, '✕'))),
    h('p', null, h('b', null, left === 0 ? 'Alle X-chips kwijt!' : `Nog ${left} X-chip${left === 1 ? '' : 's'}`)),
    h('p', { class: 'kok3-tiebreak' }, `${st.crossedCount} vakjes · pas-balk ${st.passFilled} · ${st.fullColumns} volle kolommen`),
    h('button', { type: 'button', class: 'kok3-gift', onclick: () => useGift(s, sheet) }, '🎁 Cadeau-chip inzetten'),
  );

  /* --- Meldingen --- */
  const banners: HTMLElement[] = [];
  if (sheet.freeCrosses > 0) {
    banners.push(
      h(
        'div',
        { class: 'kok2-banner bomb kok3-banner', role: 'status' },
        h('span', null, `💣 Bom: kruis nog ${sheet.freeCrosses} vakje${sheet.freeCrosses === 1 ? '' : 's'} binnen een 2×2 vlak, waar je wilt.`),
        h('button', { type: 'button', onclick: () => apply(s, { ...sheet, freeCrosses: 0 }) }, 'Klaar'),
      ),
    );
  } else if (st.bombsPending > 0) {
    banners.push(
      h(
        'div',
        { class: 'kok2-banner bomb kok3-banner', role: 'status' },
        h('span', null, '💣 Pas-balk: je mag een bom laten ontploffen.'),
        h('button', { type: 'button', class: 'btn-primary', onclick: () => apply(s, { ...sheet, bombsUsed: sheet.bombsUsed + 1, freeCrosses: BOMB_CELLS }) }, 'Ontploffen'),
        h('button', { type: 'button', onclick: () => apply(s, { ...sheet, bombsUsed: sheet.bombsUsed + 1 }) }, 'Overslaan'),
      ),
    );
  }
  if (left === 0) banners.push(h('div', { class: 'kok-end', role: 'status' }, '🏁 Al je X-chips zijn weg: het spel eindigt na deze worp.'));

  return h(
    'div',
    null,
    h(
      'div',
      { class: 'topbar' },
      h('a', { class: 'btn btn-ghost', href: '../../' }, '‹'),
      h('h1', null, 'Keer op Keer 3', s.player ? h('span', { class: 'muted' }, ` · ${s.player}`) : null),
      h('span', { class: `kok3-chipcount${left === 0 ? ' done' : ''}`, title: 'X-chips over' }, `✕ ${left}`),
      rulesButton(KOK3_RULES),
    ),
    banners,
    h(
      'div',
      { class: 'kok3-board' },
      h('div', { class: 'kok-sheet-wrap kok3-sheet-wrap' }, grid),
      passTrack,
      h('div', { class: 'kok3-bottom' }, jokerBar, colorBox, diamondBox, crossingBox, chipBox),
      h('p', { class: 'kok-help kok3-help' }, 'Roze rand = alleen voor de eerste. Was een ander eerder? Tik op die bonus om hem door te strepen.'),
    ),
    diceCard(),
    h(
      'div',
      { class: 'actions row stretch' },
      h('button', {
        class: 'btn-undo',
        disabled: s.undo.length === 0,
        'aria-label': 'Ongedaan maken',
        title: 'Ongedaan maken',
        innerHTML: UNDO_SVG,
        onclick: () => {
          const prev = s.undo[s.undo.length - 1];
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

/* ------------------------------------------------------------------ */
/* Dialoogjes                                                          */
/* ------------------------------------------------------------------ */

function openDialog(title: string, body: HTMLElement[]): HTMLDialogElement {
  const dialog = h(
    'dialog',
    { class: 'rules-dialog kok2-actions' },
    h('div', { class: 'rules-head' }, h('h2', null, title), h('button', { type: 'button', class: 'btn-ghost', 'aria-label': 'Sluiten', onclick: () => dialog.close() }, '✕')),
    h('div', { class: 'rules-body' }, body),
  );
  dialog.addEventListener('close', () => dialog.remove());
  dialog.addEventListener('click', (e) => {
    if (e.target === dialog) dialog.close();
  });
  document.body.append(dialog);
  dialog.showModal();
  return dialog;
}

function chooseStart(s: Kok3State, sheet: Sheet3): void {
  const colors = colorsFor(LAYOUT3);
  let color: ColorKey | null = sheet.startColor;
  let num: number | null = sheet.startNumber;
  const colorRow = h('div', { class: 'kok3-pick' });
  const numRow = h('div', { class: 'kok3-pick' });
  const paint = (): void => {
    colorRow.replaceChildren(
      ...COLOR_ORDER.map((c) =>
        h('button', {
          type: 'button',
          class: `kok3-pick-color${color === c ? ' on' : ''}`,
          style: `--fill:${colors[c].fill}`,
          'aria-label': colors[c].name,
          'aria-pressed': String(color === c),
          onclick: () => {
            color = c;
            paint();
          },
        }),
      ),
    );
    numRow.replaceChildren(
      ...[1, 2, 3, 4, 5].map((n) =>
        h(
          'button',
          {
            type: 'button',
            class: `kok3-pick-num${num === n ? ' on' : ''}`,
            'aria-pressed': String(num === n),
            onclick: () => {
              num = n;
              paint();
            },
          },
          String(n),
        ),
      ),
    );
  };
  paint();
  const dialog = openDialog('Startcombinatie', [
    h('p', null, 'Gooi één keer met alle stenen en kies een kleur en een getal (geen joker).'),
    colorRow,
    numRow,
    h(
      'button',
      {
        type: 'button',
        class: 'btn-primary',
        onclick: () => {
          dialog.close();
          apply(s, { ...sheet, startColor: color, startNumber: num });
        },
      },
      'Opslaan',
    ),
  ]);
}

function useGift(s: Kok3State, sheet: Sheet3): void {
  const option = (icon: string, title: string, help: string, onPick: () => void): HTMLElement =>
    h('button', { type: 'button', class: 'kok2-action', onclick: onPick }, h('span', { class: 'kok2-action-icon' }, icon), h('span', null, h('b', null, title), h('small', null, help)));
  const dialog = openDialog('Cadeau-chip inzetten', [
    h('p', { class: 'muted' }, 'Een andere speler gaf je een X-chip met een bonus. Welke staat erop?'),
    option('💣', 'Bom', 'Tot 4 vakjes in een 2×2 vlak, overal, elke kleur.', () => {
      dialog.close();
      apply(s, { ...sheet, freeCrosses: BOMB_CELLS });
    }),
    option('▦', 'Kleurblok', 'Een heel blok van één kleur (aansluitend).', () => {
      dialog.close();
      toast('▦ Kruis nu een heel blok van één kleur aan.', 3500);
    }),
    option('→', 'Drie op een rij', 'Tot 3 vakjes in één rij, elk aansluitend.', () => {
      dialog.close();
      toast('→ Kruis nu tot 3 vakjes in één rij aan.', 3500);
    }),
    option('±1', 'Getal ±1', 'Maak een cijfersteen 1 hoger of lager (geen 6).', () => {
      dialog.close();
      toast('±1: tel 1 op of af bij je cijfersteen en kruis dan aan.', 3500);
    }),
  ]);
}

/* ------------------------------------------------------------------ */
/* Dobbelstenen: 3 kleur (5 kleuren + zwart ✕) en 3 cijfer (1–5 + ?)   */
/* ------------------------------------------------------------------ */

function diceCard(): HTMLElement {
  const colors = colorsFor(LAYOUT3);
  const colorFaces: DieFace[] = [
    ...COLOR_ORDER.map((c) => ({ color: colors[c].fill, label: colors[c].name })),
    { joker: true, label: '✕' },
  ];
  const numberFaces: DieFace[] = [...[1, 2, 3, 4, 5].map((n) => ({ label: String(n) })), { joker: true, label: '?' }];
  const dice: DieSpec[] = [
    ...[1, 2, 3].map((i) => ({ id: `k${i}`, name: 'Kleur', bg: '#ffffff', ink: '#1f1d1a', faces: colorFaces })),
    ...[1, 2, 3].map((i) => ({ id: `c${i}`, name: 'Cijfer', bg: '#1f1d1a', ink: '#ffffff', faces: numberFaces })),
  ];
  return dicePanel({
    id: GAME_ID,
    dice,
    hint: 'De speler aan de beurt kiest eerst één kleur + één cijfer; daarna kiezen de anderen uit de overige stenen. ? en zwart ✕ zijn jokers (kost een !).',
  });
}

/* ------------------------------------------------------------------ */
/* Afronden                                                            */
/* ------------------------------------------------------------------ */

function finishGame(s: Kok3State): void {
  const st = status(sheetOf(s));
  if (!confirm(`Blad afronden met ${st.chipsDropped} van de ${X_CHIPS} X-chips kwijt en opslaan bij "Gespeeld"?`)) return;
  const name = s.player || 'Ik';
  addHistory({ gameId: GAME_ID, title: 'Keer op Keer 3', players: [{ name, score: st.chipsDropped }], winners: [name] });
  store.clear();
  state = null;
  render();
  if (st.chipsDropped >= X_CHIPS) confetti();
  toast(`${st.chipsDropped} X-chips kwijt · opgeslagen`);
}

function clearGame(): void {
  if (!confirm('Blad wissen zonder op te slaan?')) return;
  store.clear();
  state = null;
  render();
}

render();
