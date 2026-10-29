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
import { canCross, colorProgress, isColumnComplete } from '../keer-op-keer/scoring';
import './kok2.css';
import {
  BOMB_CELLS,
  DICE_SLOTS,
  DIE_POINTS,
  LAYOUT2,
  MAX_HEARTS,
  ROW_BONUS,
  ROW_LABELS,
  ROW_POINTS,
  bombsPending,
  cellsOf,
  diceEarned,
  emptySheet2,
  heartsCircled,
  isDieCell,
  isRowComplete,
  score2,
  settleHearts,
  type RowBonus,
  type Sheet2,
} from './model';
import { KOK2_RULES } from './rules';

/**
 * Keer op Keer 2: je eigen blad op je eigen scherm.
 * Jij kruist; de app bewaakt de aansluitregel, houdt harten, speciale dobbelstenen
 * en bommen bij en rekent alles uit.
 */

const GAME_ID = 'keer-op-keer-2';
const VERSION = 1;
const MAX_UNDO = 150;

interface Kok2State extends Sheet2 {
  version: typeof VERSION;
  player: string;
  undo: Sheet2[];
}

const STAR_SVG =
  '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2.6l2.8 5.9 6.4.8-4.7 4.4 1.2 6.4L12 17l-5.7 3.1 1.2-6.4-4.7-4.4 6.4-.8z" fill="currentColor" stroke="#fff" stroke-width="2" stroke-linejoin="round"/></svg>';
const UNDO_SVG =
  '<svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M9 14 4 9l5-5"/><path d="M4 9h10.5a5.5 5.5 0 0 1 0 11H11"/></svg>';

const ICON: Record<RowBonus, string> = { die: '🎲', bomb: '💣', heart: '❤️' };

const store = sessionStore<Kok2State>(GAME_ID, VERSION);
const LAST_KEY = `spel:${GAME_ID}:speler`;

initPage({ root: '../../', keepAwake: true });

const app = mount('#app');
let state: Kok2State | null = store.load();

function sheetOf(s: Kok2State): Sheet2 {
  const { version: _v, player: _p, undo: _u, ...sheet } = s;
  return sheet;
}

function render(): void {
  // Zijwaartse scrollpositie van het blad bewaren (telefoon), anders springt het terug na elke tik
  const left = app.querySelector<HTMLElement>('.kok-sheet-wrap')?.scrollLeft ?? 0;
  app.classList.toggle('kok-wide', Boolean(state));
  app.replaceChildren(state ? playView(state) : setupView());
  const wrap = app.querySelector<HTMLElement>('.kok-sheet-wrap');
  if (wrap) wrap.scrollLeft = left;
}

/** Nieuw blad opslaan (vorige op de ongedaan-stapel), harten bijwerken en mijlpalen vieren. */
function apply(s: Kok2State, raw: Sheet2): void {
  const prev = sheetOf(s);
  const next = settleHearts(prev, raw);
  state = { ...s, ...next, undo: [...s.undo, prev].slice(-MAX_UNDO) };
  store.save(state);
  render();

  const colors = colorsFor(LAYOUT2);
  const before = score2(prev);
  const after = score2(next);
  for (const c of after.completeColors) {
    if (!before.completeColors.includes(c)) {
      confetti();
      toast(`${colors[c as ColorKey].name} is vol!`);
    }
  }
  ROW_LABELS.forEach((label, r) => {
    if (isRowComplete(next, r) && !isRowComplete(prev, r)) {
      toast(next.rowTaken[r] ? `Rij ${label} vol: +${ROW_POINTS}` : `Rij ${label} vol: +${ROW_POINTS} en ${ICON[ROW_BONUS[r] ?? 'die']}!`, 3000);
    }
  });
  if (diceEarned(next) > diceEarned(prev)) toast('🎲 Speciale dobbelsteen verdiend!');
}

function formatScore(n: number): string {
  return n < 0 ? `−${-n}` : String(n);
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
    state = { version: VERSION, player: name, ...emptySheet2(), undo: [] };
    store.save(state);
    render();
  };
  return h(
    'form',
    { onsubmit: start },
    h('div', { class: 'topbar' }, h('a', { class: 'btn btn-ghost', href: '../../' }, '‹ Spellen'), h('h1', null, 'Keer op Keer 2'), rulesButton(KOK2_RULES)),
    h(
      'div',
      { class: 'card' },
      h('p', { style: 'margin-top:0' }, 'Iedereen houdt zijn eigen blad bij. De app telt rijen, harten, speciale dobbelstenen en bommen voor je. Tik op het vraagteken voor de spelregels.'),
      h(
        'label',
        { class: 'field' },
        h('span', null, 'Wie ben je?'),
        nameInput,
        h(
          'div',
          { class: 'chips' },
          getRecentPlayers().map((name) => h('button', { type: 'button', class: 'chip', onclick: () => ((player = name), (nameInput.value = name)) }, name)),
        ),
      ),
    ),
    h('div', { class: 'actions row stretch' }, h('button', { type: 'submit', class: 'btn-primary btn-big' }, 'Start')),
  );
}

/* ------------------------------------------------------------------ */
/* Speelblad                                                           */
/* ------------------------------------------------------------------ */

function shake(el: HTMLElement): void {
  el.classList.remove('shake');
  void el.offsetWidth;
  el.classList.add('shake');
}

function playView(s: Kok2State): HTMLElement {
  const layout = LAYOUT2;
  const sheet = sheetOf(s);
  const colors = colorsFor(layout);
  const cells = cellsOf(layout);
  const result = score2(sheet);
  const progress = colorProgress(layout, sheet);
  const hearts = heartsCircled(sheet);
  const earnedDice = diceEarned(sheet);
  const pendingBombs = bombsPending(sheet);
  const H = layout.startColumn;

  /* --- Raster: [5][bonus] A..O [letter] --- */
  const grid = h('div', { class: 'kok-sheet kok2-sheet' });
  const spacer = (): HTMLElement => h('span', { class: 'kok2-spacer' });

  grid.append(spacer(), spacer());
  layout.columnLabels.forEach((label, col) =>
    grid.append(h('div', { class: `kok-head${col === H ? ' start' : ''}${isColumnComplete(layout, sheet, col) ? ' complete' : ''}` }, label)),
  );
  grid.append(spacer());

  ROW_LABELS.forEach((label, r) => {
    const complete = isRowComplete(sheet, r);
    const taken = sheet.rowTaken[r];
    const kind = ROW_BONUS[r] ?? 'die';
    grid.append(
      h('span', { class: `kok2-rowpts${complete ? ' won' : ''}`, title: `Rij ${label} vol: ${ROW_POINTS} punten` }, ROW_POINTS),
      h(
        'button',
        {
          type: 'button',
          class: `kok2-rowbonus${complete && !taken ? ' won' : ''}${taken ? ' taken' : ''}`,
          title: taken ? 'Een ander was eerder (tik om terug te zetten)' : 'Tik als een ander deze rij eerder vol had',
          'aria-label': `Rijbonus ${label}: ${kind}`,
          onclick: () => {
            const rowTaken = [...sheet.rowTaken];
            rowTaken[r] = !rowTaken[r];
            apply(s, { ...sheet, rowTaken });
          },
        },
        ICON[kind],
      ),
    );
    cells
      .filter((c) => c.row === r)
      .forEach((cell) => {
        const info = colors[cell.color];
        const crossed = Boolean(sheet.crossed[cell.index]);
        const free = sheet.freeCrosses > 0;
        const reachable = free || canCross(layout, sheet, cell);
        grid.append(
          h(
            'button',
            {
              type: 'button',
              class: `kok-cell${cell.star ? ' star' : ''}${cell.col === H ? ' start' : ''}${crossed ? ' crossed' : ''}${!crossed && !reachable ? ' blocked' : ''}${free && !crossed ? ' bomb-target' : ''}`,
              style: `--fill:${info.fill};--ink:${info.ink}`,
              'aria-label': `${layout.columnLabels[cell.col] ?? ''}${label} ${info.name}${cell.star ? ' ster' : ''}${isDieCell(r, cell.col) ? ' dobbelsteen' : ''}`,
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
            cell.star ? h('span', { class: 'kok-star', innerHTML: STAR_SVG }) : null,
            isDieCell(r, cell.col) ? h('span', { class: 'kok2-diecell' }, '🎲') : null,
          ),
        );
      });
    grid.append(h('div', { class: `kok-head kok2-rowlabel${complete ? ' complete' : ''}` }, label));
  });

  // Kolompunten (eerste / later) en hartwaarden
  const toggleColumn = (col: number): void => {
    const columnTaken = [...sheet.columnTaken];
    columnTaken[col] = !columnTaken[col];
    apply(s, { ...sheet, columnTaken });
  };
  const pointRow = (which: 0 | 1): void => {
    grid.append(spacer(), spacer());
    layout.columnPoints.forEach((pts, col) => {
      const complete = isColumnComplete(layout, sheet, col);
      const taken = Boolean(sheet.columnTaken[col]);
      const won = which === 0 ? complete && !taken : complete && taken;
      grid.append(
        h(
          'button',
          {
            type: 'button',
            class: `kok-points ${which === 0 ? 'first' : 'later'}${col === H ? ' start' : ''}${won ? ' won' : ''}${which === 0 && taken ? ' taken' : ''}`,
            title: 'Tik als een ander deze kolom eerder vol had',
            onclick: () => toggleColumn(col),
          },
          pts[which],
          col === H ? h('span', { class: 'kok2-hdie' }, '🎲') : null,
        ),
      );
    });
    grid.append(spacer());
  };
  pointRow(0);
  pointRow(1);
  grid.append(spacer(), h('span', { class: 'kok2-heartlabel' }, '❤️'));
  sheet.colHeart.forEach((v, col) => {
    const full = isColumnComplete(layout, sheet, col);
    grid.append(h('span', { class: `kok2-colheart${full ? ' filled' : ''}`, title: 'Hartwaarde bij deze kolom' }, full && v !== null ? v : ''));
  });
  grid.append(spacer());

  /* --- Harten, jokers, speciale dobbelstenen --- */
  const heartTrack = h(
    'div',
    { class: 'kok2-hearts', title: 'Omcirkelde harten: de waarde die je noteert bij een volle kolom' },
    Array.from({ length: MAX_HEARTS }, (_, i) => h('span', { class: `kok2-heart${i < hearts ? ' on' : ''}` }, i + 1)),
  );

  const jokerButtons = Array.from({ length: layout.jokers }, (_, i) =>
    h(
      'button',
      {
        type: 'button',
        class: `kok-joker${i < sheet.jokersUsed ? ' used' : ''}`,
        'aria-label': `Joker ${i + 1}`,
        onclick: () => apply(s, { ...sheet, jokersUsed: i < sheet.jokersUsed ? i : i + 1 }),
      },
      '!',
    ),
  );

  const dieSlots = Array.from({ length: DICE_SLOTS }, (_, i) => {
    const earned = i < earnedDice;
    const used = i < sheet.diceUsed;
    return h(
      'button',
      {
        type: 'button',
        class: `kok2-die${earned ? ' earned' : ''}${used ? ' used' : ''}`,
        disabled: !earned,
        title: used ? 'Gebruikt (tik om terug te zetten)' : earned ? 'Tik als je deze speciale dobbelsteen gebruikt' : 'Nog niet verdiend',
        'aria-label': `Speciale dobbelsteen ${i + 1}`,
        onclick: () => {
          if (used) {
            apply(s, { ...sheet, diceUsed: i });
            return;
          }
          if (sheet.diceUsed >= earnedDice) return;
          chooseAction(s, sheet);
        },
      },
      '🎲',
    );
  });

  const extras = h(
    'div',
    { class: 'kok2-extras' },
    h('div', { class: 'kok-joker-strip' }, h('span', { class: 'kok-joker-label' }, '?/✕ ='), jokerButtons),
    h('div', { class: 'kok2-strip' }, h('span', { class: 'kok-joker-label' }, '❤️'), heartTrack),
    h('div', { class: 'kok2-strip' }, dieSlots),
  );

  /* --- Kleurbonus --- */
  const toggleColor = (c: ColorKey): void => apply(s, { ...sheet, colorTaken: { ...sheet.colorTaken, [c]: !sheet.colorTaken[c] } });
  const colorsBox = h(
    'div',
    { class: 'kok-colors' },
    COLOR_ORDER.map((c) => {
      const { done, total } = progress[c];
      const complete = result.completeColors.includes(c);
      const taken = sheet.colorTaken[c];
      const tile = (value: number, kind: 'first' | 'later', won: boolean): HTMLElement =>
        h(
          'button',
          {
            type: 'button',
            class: `kok-tile ${kind}${won ? ' won' : ''}${kind === 'first' && taken ? ' taken' : ''}`,
            style: `--fill:${colors[c].fill}`,
            'aria-label': `${colors[c].name} bonus ${value}`,
            onclick: () => toggleColor(c),
          },
          value,
        );
      return h(
        'div',
        { class: `kok-color${complete ? ' complete' : ''}` },
        h('span', { class: 'kok-count' }, `${done}/${total}`),
        tile(layout.colorBonus[0], 'first', complete && !taken),
        tile(layout.colorBonus[1], 'later', complete && taken),
      );
    }),
  );

  /* --- Score --- */
  const scoreRow = (label: Node | string, sign: string, value: number, extra = ''): HTMLElement =>
    h(
      'div',
      { class: `kok-score-row ${extra}` },
      h('span', { class: 'kok-label' }, label),
      h('span', { class: `kok-sign ${extra}` }, sign),
      h('span', { class: 'kok-box' }, extra === 'total' ? formatScore(value) : value),
    );
  const scoresBox = h(
    'div',
    { class: 'kok-scores' },
    scoreRow('Bonus', '=', result.colors, 'bonus'),
    scoreRow('A–O', '+', result.columns, 'plus'),
    scoreRow('P–V', '+', result.rows, 'plus'),
    scoreRow('❤️', '+', result.hearts, 'plus'),
    scoreRow(h('span', null, h('span', { class: 'kok-icon-joker' }, '!'), ' (+1)'), '+', result.jokers, 'plus'),
    scoreRow(`🎲 (+${DIE_POINTS})`, '+', result.dice, 'plus'),
    scoreRow(h('span', null, h('span', { class: 'kok-icon-star', innerHTML: STAR_SVG }), ' (−2)'), '−', Math.abs(result.stars), 'minus'),
    h('hr'),
    scoreRow('Totaal', '=', result.total, 'total'),
  );

  /* --- Meldingen: bom actief / verdiend, einde spel --- */
  const banners: HTMLElement[] = [];
  if (sheet.freeCrosses > 0) {
    banners.push(
      h(
        'div',
        { class: 'kok2-banner bomb', role: 'status' },
        h('span', null, `💣 Bom: kruis nog ${sheet.freeCrosses} vakje${sheet.freeCrosses === 1 ? '' : 's'} binnen een 2×2 vlak, waar je wilt.`),
        h('button', { type: 'button', onclick: () => apply(s, { ...sheet, freeCrosses: 0 }) }, 'Klaar'),
      ),
    );
  } else if (pendingBombs > 0) {
    banners.push(
      h(
        'div',
        { class: 'kok2-banner bomb', role: 'status' },
        h('span', null, `💣 Rijbonus: je mag ${pendingBombs === 1 ? 'een bom' : `${pendingBombs} bommen`} laten ontploffen.`),
        h('button', { type: 'button', class: 'btn-primary', onclick: () => apply(s, { ...sheet, bombsUsed: sheet.bombsUsed + 1, freeCrosses: BOMB_CELLS }) }, 'Ontploffen'),
        h('button', { type: 'button', onclick: () => apply(s, { ...sheet, bombsUsed: sheet.bombsUsed + 1 }) }, 'Overslaan'),
      ),
    );
  }
  if (result.completeColors.length >= 2) {
    banners.push(h('div', { class: 'kok-end', role: 'status' }, `🏁 ${result.completeColors.length} kleuren vol: het spel eindigt na deze worp.`));
  }

  return h(
    'div',
    null,
    h(
      'div',
      { class: 'topbar' },
      h('a', { class: 'btn btn-ghost', href: '../../' }, '‹'),
      h('h1', null, 'Keer op Keer 2', s.player ? h('span', { class: 'muted' }, ` · ${s.player}`) : null),
      rulesButton(KOK2_RULES),
    ),
    banners,
    h(
      'div',
      { class: 'kok-board kok2-board' },
      h('div', { class: 'kok-sheet-wrap' }, grid),
      colorsBox,
      scoresBox,
      extras,
      h('p', { class: 'kok-help' }, 'Een ander eerder met een kolom, rij of kleur? Tik op de punten of de bonus.'),
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
      h('button', { class: 'btn-danger', onclick: () => clearGame() }, 'Wissen'),
      h('button', { class: 'btn-primary', onclick: () => finishGame(s) }, 'Afronden'),
    ),
  );
}

/** Speciale dobbelsteen inzetten: kies de actie die je gegooid hebt. */
function chooseAction(s: Kok2State, sheet: Sheet2): void {
  const use = (extra: Partial<Sheet2>, msg?: string): void => {
    dialog.close();
    apply(s, { ...sheet, diceUsed: sheet.diceUsed + 1, ...extra });
    if (msg) toast(msg, 3500);
  };
  const option = (icon: string, title: string, help: string, onPick: () => void): HTMLElement =>
    h('button', { type: 'button', class: 'kok2-action', onclick: onPick }, h('span', { class: 'kok2-action-icon' }, icon), h('span', null, h('b', null, title), h('small', null, help)));

  const dialog = h(
    'dialog',
    { class: 'rules-dialog kok2-actions' },
    h('div', { class: 'rules-head' }, h('h2', null, 'Speciale dobbelsteen'), h('button', { type: 'button', class: 'btn-ghost', 'aria-label': 'Sluiten', onclick: () => dialog.close() }, '✕')),
    h(
      'div',
      { class: 'rules-body' },
      option('💣', 'Bom', 'Tot 4 vakjes in een 2×2 vlak, overal, elke kleur.', () => use({ freeCrosses: BOMB_CELLS })),
      option('❤️', 'Hart', 'Omcirkel het volgende hart.', () => {
        if (heartsCircled(sheet) >= MAX_HEARTS) {
          toast('Alle harten zijn al omcirkeld');
          return;
        }
        use({ heartsFromDice: sheet.heartsFromDice + 1 });
      }),
      option('⭐', 'Sterren', 'Kruis maximaal 2 sterren aan (aansluitend).', () => use({}, '⭐ Kruis nu maximaal 2 sterren aan.')),
      option('➖', 'Drie op een rij', 'Maximaal 3 vakjes in één rij (aansluitend).', () => use({}, '➖ Kruis nu maximaal 3 vakjes in één rij aan.')),
      option('▦', 'Kleurblok', 'Een heel blok van één kleur (aansluitend).', () => use({}, '▦ Kruis nu een heel blok van één kleur aan.')),
    ),
  );
  dialog.addEventListener('close', () => dialog.remove());
  dialog.addEventListener('click', (e) => {
    if (e.target === dialog) dialog.close();
  });
  document.body.append(dialog);
  dialog.showModal();
}

/* ------------------------------------------------------------------ */
/* Dobbelstenen                                                        */
/* ------------------------------------------------------------------ */

function diceCard(): HTMLElement {
  const colors = colorsFor(LAYOUT2);
  const joker: DieFace = { joker: true, label: '?' };
  const colorFaces: DieFace[] = [...COLOR_ORDER.map((c) => ({ color: colors[c].fill, label: colors[c].name })), joker];
  const numberFaces: DieFace[] = [...[1, 2, 3, 4, 5].map((n) => ({ label: String(n) })), joker];
  // 6 zijden: het hart staat er twee keer op
  const specialFaces: DieFace[] = [{ label: '💣' }, { label: '❤️' }, { label: '❤️' }, { label: '⭐' }, { label: '➖' }, { label: '▦' }];
  const dice: DieSpec[] = [
    ...[1, 2, 3].map((i) => ({ id: `k${i}`, name: 'Kleur', bg: '#ffffff', ink: '#1f1d1a', faces: colorFaces })),
    ...[1, 2, 3].map((i) => ({ id: `c${i}`, name: 'Cijfer', bg: '#1f1d1a', ink: '#ffffff', faces: numberFaces })),
    { id: 'special', name: 'Speciaal', bg: '#e8c27a', ink: '#1f1d1a', faces: specialFaces },
  ];
  return dicePanel({
    id: GAME_ID,
    dice,
    hint: 'Kies één kleur + één cijfer, of de speciale (gouden) steen als je er een omcirkeld hebt. Het vraagteken is een joker, op de kleur- én cijferstenen (kost een !).',
  });
}

/* ------------------------------------------------------------------ */
/* Afronden                                                            */
/* ------------------------------------------------------------------ */

function finishGame(s: Kok2State): void {
  const total = score2(sheetOf(s)).total;
  if (!confirm(`Blad afronden met ${formatScore(total)} punten en opslaan bij "Gespeeld"?`)) return;
  const name = s.player || 'Ik';
  addHistory({ gameId: GAME_ID, title: 'Keer op Keer 2', players: [{ name, score: total }], winners: [name] });
  store.clear();
  state = null;
  render();
  confetti();
  toast(`${formatScore(total)} punten opgeslagen`);
}

function clearGame(): void {
  if (!confirm('Blad wissen zonder op te slaan?')) return;
  store.clear();
  state = null;
  render();
}

render();
