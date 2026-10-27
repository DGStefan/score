import { confetti } from '@shared/confetti';
import { dicePanel, pipFaces, type DieSpec } from '@shared/dice';
import { h, mount, toast } from '@shared/dom';
import { addHistory } from '@shared/history';
import { initPage } from '@shared/page';
import { getRecentPlayers, rememberPlayers } from '@shared/players';
import { rulesButton } from '@shared/rules';
import { sessionStore } from '@shared/session';
import { readJSON, writeJSON } from '@shared/storage';
import './qwixx.css';
import { QWIXX_RULES } from './rules';
import {
  LAST_INDEX,
  MAX_PENALTIES,
  MIN_TO_LOCK,
  PENALTY_POINTS,
  ROWS,
  checkCross,
  cross,
  crossCount,
  emptySheet,
  gameOver,
  score,
  type Sheet,
} from './scoring';

/**
 * Qwixx: je eigen scoreblad op je eigen scherm.
 * De app bewaakt alleen de afkruisregels (links → rechts, slot pas na 5 kruisjes)
 * en rekent de punten uit. Optioneel: digitale dobbelstenen voor wie ze niet bij de hand heeft.
 */

const GAME_ID = 'qwixx';
const VERSION = 1;
const MAX_UNDO = 100;

interface QwixxState extends Sheet {
  version: typeof VERSION;
  player: string;
  /** Eerdere bladen, voor ongedaan maken. */
  undo: Sheet[];
}

const store = sessionStore<QwixxState>(GAME_ID, VERSION);
const LAST_KEY = `spel:${GAME_ID}:speler`;

initPage({ root: '../../', keepAwake: true });

const app = mount('#app');
let state: QwixxState | null = store.load();


function sheetOf(s: QwixxState): Sheet {
  return { marks: s.marks, locked: s.locked, penalties: s.penalties };
}

function render(): void {
  app.classList.toggle('qx-wide', Boolean(state));
  app.replaceChildren(state ? playView(state) : setupView());
}

/** Nieuw blad opslaan; het vorige blad gaat op de ongedaan-stapel. */
function apply(s: QwixxState, next: Sheet): void {
  const undo = [...s.undo, sheetOf(s)].slice(-MAX_UNDO);
  state = { ...s, ...next, undo };
  store.save(state);
  render();
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
    state = { version: VERSION, player: name, ...emptySheet(), undo: [] };
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
      h('h1', null, 'Qwixx'),
      rulesButton(QWIXX_RULES),
    ),
    h(
      'div',
      { class: 'card' },
      h('p', { style: 'margin-top:0' }, 'Iedereen houdt zijn eigen blad bij op zijn eigen scherm. Nieuw met Qwixx? Tik op het vraagteken voor de spelregels.'),
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

/* ------------------------------------------------------------------ */
/* Scoreblad                                                           */
/* ------------------------------------------------------------------ */

function playView(s: QwixxState): HTMLElement {
  const sheet = sheetOf(s);
  const result = score(sheet);
  const over = gameOver(sheet);

  const rows = ROWS.map((row) => {
    const marks = s.marks[row.key];
    const last = marks[marks.length - 1];
    const locked = s.locked[row.key];
    const count = crossCount(sheet, row.key);

    const cells = row.numbers.map((n, i) => {
      const crossed = marks.includes(i);
      const skipped = !crossed && last !== undefined && i < last;
      const needsMore = i === LAST_INDEX && !crossed && marks.length < MIN_TO_LOCK;
      const classes = ['qx-cell'];
      if (crossed) classes.push('crossed');
      else if (skipped || locked) classes.push('skipped');
      else if (needsMore) classes.push('needs-more');
      if (i === LAST_INDEX) classes.push('last');
      return h(
        'button',
        {
          type: 'button',
          class: classes.join(' '),
          'aria-label': `${row.name} ${n}${crossed ? ' (afgekruist)' : ''}`,
          'aria-pressed': String(crossed),
          onclick: (e: Event) => {
            if (crossed) {
              toast('Vergist? Gebruik de knop ↶ om terug te gaan');
              return;
            }
            const check = checkCross(sheet, row.key, i);
            if (!check.ok) {
              shake(e.currentTarget as HTMLElement);
              toast(check.reason);
              return;
            }
            apply(s, cross(sheet, row.key, i));
            if (check.locks) {
              confetti();
              toast(`🔒 ${row.name} afgesloten! Zeg het hardop, de ${row.name.toLowerCase()}e steen gaat uit het spel.`, 4000);
            }
          },
        },
        h('span', { class: 'qx-num' }, n),
        needsMore ? h('small', null, `${MIN_TO_LOCK}×`) : null,
      );
    });

    const lockButton = h(
      'button',
      {
        type: 'button',
        class: `qx-lock${locked ? ` ${locked}` : ''}`,
        'aria-label': locked === 'self' ? `${row.name}: door jou afgesloten` : locked === 'other' ? `${row.name}: door een ander afgesloten` : `${row.name}: afgesloten door een ander?`,
        title: locked === 'self' ? 'Door jou afgesloten' : 'Tik als een andere speler deze rij afsloot',
        onclick: () => {
          if (locked === 'self') {
            toast('Jij sloot deze rij af. Vergist? Gebruik ↶');
            return;
          }
          if (locked === 'other') {
            apply(s, { ...sheet, locked: { ...s.locked, [row.key]: null } });
            return;
          }
          if (!confirm(`Heeft een andere speler ${row.name.toLowerCase()} afgesloten? Dan kun jij hier niet meer kruisen.`)) return;
          apply(s, { ...sheet, locked: { ...s.locked, [row.key]: 'other' } });
        },
      },
      locked ? '🔒' : '🔓',
    );

    return h(
      'div',
      { class: `qx-row${locked ? ' is-locked' : ''}`, style: `--row:${row.color};--row-light:${row.light}` },
      h('div', { class: 'qx-cells' }, cells, lockButton),
      h('div', { class: 'qx-row-score' }, h('small', null, `${count}×`), h('strong', null, result.rows[row.key])),
    );
  });

  const penaltyBoxes = Array.from({ length: MAX_PENALTIES }, (_, i) =>
    h(
      'button',
      {
        type: 'button',
        class: `qx-penalty${i < s.penalties ? ' used' : ''}`,
        'aria-label': `Misworp ${i + 1}`,
        onclick: () => apply(s, { ...sheet, penalties: i < s.penalties ? i : i + 1 }),
      },
      i < s.penalties ? '✕' : '',
    ),
  );

  const summary = h(
    'div',
    { class: 'qx-summary' },
    ROWS.map((row, i) => [
      i > 0 ? h('span', { class: 'qx-op' }, '+') : null,
      h('span', { class: 'qx-sum-box', style: `--row:${row.color}` }, result.rows[row.key]),
    ]).flat(),
    h('span', { class: 'qx-op' }, '−'),
    h('span', { class: 'qx-sum-box penalty' }, -result.penalties),
    h('span', { class: 'qx-op' }, '='),
    h('span', { class: 'qx-sum-box total' }, formatScore(result.total)),
  );

  return h(
    'div',
    { class: 'qx' },
    h(
      'div',
      { class: 'topbar' },
      h('a', { class: 'btn btn-ghost', href: '../../' }, '‹'),
      h('h1', null, 'Qwixx', s.player ? h('span', { class: 'muted' }, ` · ${s.player}`) : null),
      rulesButton(QWIXX_RULES),
    ),
    over ? h('div', { class: 'goal-banner', role: 'status' }, h('strong', null, '🏁 '), over, ' Tel af en rond je blad af.') : null,
    h('p', { class: 'qx-tip muted' }, '📱 Tip: kantel je telefoon voor een groter blad.'),
    h('div', { class: 'card qx-sheet' }, rows),
    h(
      'div',
      { class: 'card qx-bottom' },
      h(
        'div',
        { class: 'qx-penalties' },
        h('span', { class: 'qx-label' }, 'Misworpen', h('small', null, `−${PENALTY_POINTS} per stuk`)),
        h('div', { class: 'qx-penalty-boxes' }, penaltyBoxes),
      ),
      summary,
    ),
    diceCard(s),
    h(
      'div',
      { class: 'actions row stretch' },
      h(
        'button',
        {
          class: 'btn-undo',
          disabled: s.undo.length === 0,
          'aria-label': 'Ongedaan maken',
          title: 'Ongedaan maken',
          onclick: () => {
            const prev = s.undo[s.undo.length - 1];
            if (!prev) return;
            state = { ...s, ...prev, undo: s.undo.slice(0, -1) };
            store.save(state);
            render();
          },
          innerHTML:
            '<svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M9 14 4 9l5-5"/><path d="M4 9h10.5a5.5 5.5 0 0 1 0 11H11"/></svg>',
        },
      ),
      h('button', { class: 'btn-danger', onclick: () => clearGame() }, 'Wissen'),
      h('button', { class: 'btn-primary', onclick: () => finishGame(s) }, 'Afronden'),
    ),
  );
}

function shake(el: HTMLElement): void {
  el.classList.remove('shake');
  void el.offsetWidth;
  el.classList.add('shake');
}

/* ------------------------------------------------------------------ */
/* Digitale dobbelstenen (optioneel, standaard ingeklapt)              */
/* ------------------------------------------------------------------ */

const WHITE = { bg: '#ffffff', ink: '#1f1d1a' };

function diceCard(s: QwixxState): HTMLElement {
  const dice: DieSpec[] = [
    { id: 'w1', name: 'Wit', ...WHITE, faces: pipFaces() },
    { id: 'w2', name: 'Wit', ...WHITE, faces: pipFaces() },
    ...ROWS.map((r) => ({
      id: r.key,
      name: r.name,
      bg: r.color,
      ink: r.key === 'yellow' ? '#1f1d1a' : '#ffffff',
      faces: pipFaces(),
      out: Boolean(s.locked[r.key]),
    })),
  ];
  return dicePanel({
    id: GAME_ID,
    dice,
    describe: (roll) => {
      const v = (id: string): number => roll[id]?.pips ?? 0;
      const open = ROWS.filter((r) => !s.locked[r.key]);
      return h(
        'div',
        { class: 'qx-sums' },
        h('p', null, h('strong', null, `Iedereen: wit + wit = ${v('w1') + v('w2')}`)),
        open.length > 0 ? h('p', { class: 'muted' }, 'Alleen de speler aan de beurt, wit + kleur:') : null,
        h(
          'ul',
          null,
          open.map((r) => {
            const a = v('w1') + v(r.key);
            const b = v('w2') + v(r.key);
            const options = a === b ? `${a}` : `${Math.min(a, b)} of ${Math.max(a, b)}`;
            return h('li', { style: `--row:${r.color}` }, h('b', null, r.name), ` ${options}`);
          }),
        ),
      );
    },
  });
}

/* ------------------------------------------------------------------ */
/* Afronden                                                            */
/* ------------------------------------------------------------------ */

function finishGame(s: QwixxState): void {
  const total = score(sheetOf(s)).total;
  if (!confirm(`Blad afronden met ${formatScore(total)} punten en opslaan bij "Gespeeld"?`)) return;
  const name = s.player || 'Ik';
  addHistory({ gameId: GAME_ID, title: 'Qwixx', players: [{ name, score: total }], winners: [name] });
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
