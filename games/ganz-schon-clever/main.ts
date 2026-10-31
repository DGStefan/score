import { confetti } from '@shared/confetti';
import { h, mount, toast } from '@shared/dom';
import { addHistory } from '@shared/history';
import { initPage } from '@shared/page';
import { getRecentPlayers, rememberPlayers } from '@shared/players';
import { rulesButton } from '@shared/rules';
import { sessionStore } from '@shared/session';
import { readJSON, writeJSON } from '@shared/storage';
import './gsc.css';
import {
  AREA_COLORS,
  BLUE_COL_BONUS,
  BLUE_GRID,
  BLUE_POINTS,
  BLUE_ROW_BONUS,
  GREEN_BONUS,
  GREEN_MIN,
  GREEN_POINTS,
  ORANGE_BONUS,
  ORANGE_MULT,
  PURPLE_BONUS,
  ROUND_BONUS,
  TRACK_SIZE,
  YELLOW_COL_POINTS,
  YELLOW_DIAGONAL_BONUS,
  YELLOW_PRESET,
  YELLOW_ROW_BONUS,
  YELLOW_VALUES,
  bonusHelp,
  bonusLabel,
  consumeBonus,
  countKind,
  earnedBonuses,
  emptySheet,
  pendingBonuses,
  purpleAllowed,
  score,
  yellowCrossed,
  type Bonus,
  type BonusKind,
  type Sheet,
} from './model';
import { GSC_RULES } from './rules';

/**
 * Clever: je eigen blad op je eigen scherm.
 * Jij kruist en vult in; de app ziet welke bonussen je verdient, telt vossen,
 * herworpen en +1'en, bewaakt de volgorde-regels en rekent de punten uit.
 */

const GAME_ID = 'ganz-schon-clever';
const VERSION = 1;
const MAX_UNDO = 150;

interface GscState extends Sheet {
  version: typeof VERSION;
  player: string;
  undo: Sheet[];
  /** Drie kladvakjes linksboven (zoals op het blad), los van de score. */
  notes?: (number | null)[];
  /** Aantal spelers aan tafel; bepaalt het aantal rondes. */
  playerCount?: number;
}

/** 1–2 spelers: 6 rondes, 3 spelers: 5, 4 spelers: 4. */
function maxRounds(players: number | undefined): number {
  if (!players || players <= 2) return 6;
  return players === 3 ? 5 : 4;
}
const COUNT_KEY = `spel:ganz-schon-clever:aantal`;

const store = sessionStore<GscState>(GAME_ID, VERSION);
const LAST_KEY = `spel:${GAME_ID}:speler`;

initPage({ root: '../../', keepAwake: true });

const app = mount('#app');
let state: GscState | null = store.load();

function sheetOf(s: GscState): Sheet {
  const { version: _v, player: _p, undo: _u, notes: _n, playerCount: _c, ...sheet } = s;
  return sheet;
}

function render(): void {
  app.classList.toggle('gsc-wide', Boolean(state));
  app.replaceChildren(state ? playView(state) : setupView());
}

/** Nieuw blad opslaan (vorige op de ongedaan-stapel) en nieuwe bonussen melden. */
function apply(s: GscState, raw: Sheet): void {
  const prev = sheetOf(s);
  const before = new Set(earnedBonuses(prev).map((b) => b.id));
  const { sheet: next, used } = consumeBonus(prev, raw);
  state = { ...s, ...next, undo: [...s.undo, prev].slice(-MAX_UNDO) };
  store.save(state);
  render();
  const fresh = earnedBonuses(next).filter((b) => !before.has(b.id) && !b.id.startsWith('round-'));
  const messages: string[] = [];
  if (used) messages.push(`✓ Bonus "${bonusLabel(used.kind)}" gebruikt`);
  if (fresh.length > 0) {
    confetti({ count: 60 });
    messages.push(`🎁 Bonus: ${fresh.map((b) => bonusLabel(b.kind)).join(', ')}`);
  }
  if (messages.length) toast(messages.join(' · '), 3500);
}

/** Openstaande getal-bonus voor oranje of paars (bv. "6 in paars"), als die er is. */
function valueBonus(sheet: Sheet, area: 'orange' | 'purple'): number | null {
  for (const b of pendingBonuses(sheet)) {
    if (area === 'orange' && b.kind === 'orange4') return 4;
    if (area === 'orange' && b.kind === 'orange5') return 5;
    if (area === 'orange' && b.kind === 'orange6') return 6;
    if (area === 'purple' && b.kind === 'purple6') return 6;
  }
  return null;
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
  let count = readJSON<number>(COUNT_KEY, 2);
  const countRow = h('div', { class: 'segmented', role: 'radiogroup', 'aria-label': 'Aantal spelers' });
  const roundsNote = h('small', { class: 'muted' });
  const paintCount = (): void => {
    countRow.replaceChildren(
      ...[1, 2, 3, 4].map((n) =>
        h(
          'label',
          null,
          h('input', {
            type: 'radio',
            name: 'aantal',
            checked: count === n,
            onchange: () => {
              count = n;
              paintCount();
            },
          }),
          String(n),
        ),
      ),
    );
    roundsNote.textContent = `${maxRounds(count)} rondes`;
  };
  paintCount();
  const start = (e: Event): void => {
    e.preventDefault();
    const name = player.trim();
    writeJSON(LAST_KEY, name);
    writeJSON(COUNT_KEY, count);
    if (name) rememberPlayers([name]);
    state = { version: VERSION, player: name, playerCount: count, ...emptySheet(), undo: [] };
    store.save(state);
    render();
  };
  return h(
    'form',
    { onsubmit: start },
    h('div', { class: 'topbar' }, h('a', { class: 'btn btn-ghost', href: '../../' }, '‹ Spellen'), h('h1', null, 'Clever'), rulesButton(GSC_RULES)),
    h(
      'div',
      { class: 'card' },
      h('p', { style: 'margin-top:0' }, 'Iedereen vult zijn eigen blad in op zijn eigen scherm. De app herkent bonussen en rekent alles uit. Nieuw met het spel? Tik op het vraagteken.'),
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
      h('div', { class: 'field' }, h('span', null, 'Met hoeveel spelers?'), countRow, roundsNote),
    ),
    h('div', { class: 'actions row stretch' }, h('button', { type: 'submit', class: 'btn-primary btn-big' }, 'Start')),
  );
}

/* ------------------------------------------------------------------ */
/* Kleine bouwstenen                                                   */
/* ------------------------------------------------------------------ */

const ICON_REROLL = '⟲';

/** Bonus-plaatje zoals op het blad; "lit" als je hem verdiend hebt. */
function bonusTag(kind: BonusKind, lit = false): HTMLElement {
  const map: Record<BonusKind, { cls: string; text: string }> = {
    reroll: { cls: 'black', text: ICON_REROLL },
    plus: { cls: 'black', text: '+1' },
    fox: { cls: 'fox', text: '🦊' },
    yellowX: { cls: 'yellow', text: '✕' },
    blueX: { cls: 'blue', text: '✕' },
    greenX: { cls: 'green', text: '✕' },
    orange4: { cls: 'orange', text: '4' },
    orange5: { cls: 'orange', text: '5' },
    orange6: { cls: 'orange', text: '6' },
    purple6: { cls: 'purple', text: '6' },
    anyX6: { cls: 'black', text: '✕|6' },
  };
  const m = map[kind];
  return h('span', { class: `gsc-tag ${m.cls}${lit ? ' lit' : ''}`, title: bonusLabel(kind) }, m.text);
}

function shake(el: HTMLElement): void {
  el.classList.remove('shake');
  void el.offsetWidth;
  el.classList.add('shake');
}

/** Getal 1–6 kiezen (oranje/paars). */
function pickNumber(
  title: string,
  allowed: (n: number) => boolean,
  onPick: (n: number) => void,
  onClear?: () => void,
  bonus?: number | null,
): void {
  const dialog = h(
    'dialog',
    { class: 'gsc-picker' },
    h('h3', null, title),
    bonus
      ? h(
          'button',
          {
            type: 'button',
            class: 'btn-primary gsc-picker-bonus',
            onclick: () => {
              dialog.close();
              onPick(bonus);
            },
          },
          `🎁 Bonus: ${bonus} invullen`,
        )
      : null,
    bonus ? h('small', { class: 'muted' }, 'Of een gewone steen:') : null,
    h(
      'div',
      { class: 'gsc-picker-grid' },
      [1, 2, 3, 4, 5, 6].map((n) =>
        h(
          'button',
          {
            type: 'button',
            disabled: !allowed(n),
            onclick: () => {
              dialog.close();
              onPick(n);
            },
          },
          n,
        ),
      ),
    ),
    h(
      'div',
      { class: 'row stretch' },
      onClear
        ? h(
            'button',
            {
              type: 'button',
              onclick: () => {
                dialog.close();
                onClear();
              },
            },
            'Leeg maken',
          )
        : null,
      h('button', { type: 'button', class: 'btn-ghost', onclick: () => dialog.close() }, 'Annuleren'),
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
/* Speelblad — opgebouwd als het papieren blad, schaalt mee met de breedte */
/* ------------------------------------------------------------------ */

function playView(s: GscState): HTMLElement {
  const sheet = sheetOf(s);
  const earned = new Set(earnedBonuses(sheet).map((b) => b.id));
  const result = score(sheet);

  return h(
    'div',
    { class: 'gsc' },
    h(
      'div',
      { class: 'topbar' },
      h('a', { class: 'btn btn-ghost', href: '../../' }, '‹'),
      h('h1', null, 'Clever', s.player ? h('span', { class: 'muted' }, ` · ${s.player}`) : null),
      h(
        'button',
        {
          type: 'button',
          class: 'gsc-roundpill',
          title: 'Aantal spelers (tik om te wijzigen)',
          onclick: () => {
            const count = ((s.playerCount ?? 2) % 4) + 1;
            writeJSON(COUNT_KEY, count);
            state = { ...s, playerCount: count };
            store.save(state);
            render();
            toast(`${count} speler${count === 1 ? '' : 's'}: ${maxRounds(count)} rondes`);
          },
        },
        `Ronde ${Math.min(s.rounds, maxRounds(s.playerCount))}/${maxRounds(s.playerCount)} · 👤${s.playerCount ?? '?'}`,
      ),
      rulesButton(GSC_RULES),
    ),
    pendingView(s, sheet),
    h(
      'div',
      { class: 'gsc-sheet-wrap' },
      h(
        'div',
        { class: 'gsc-sheet' },
        h('div', { class: 'gsc-col' }, topView(s, sheet), h('div', { class: 's-mid' }, yellowView(s, sheet, earned), blueView(s, sheet, earned))),
        h('div', { class: 'gsc-col' }, greenView(s, sheet), orangeView(s, sheet), purpleView(s, sheet)),
      ),
    ),
    scoreView(result),
    h(
      'div',
      { class: 'actions row stretch' },
      h('button', {
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
      }),
      h('button', { class: 'btn-danger', onclick: () => clearGame() }, 'Wissen'),
      h('button', { class: 'btn-primary', onclick: () => finishGame(s) }, 'Afronden'),
    ),
  );
}

/* ---------- Openstaande bonussen ---------- */

function pendingView(s: GscState, sheet: Sheet): HTMLElement | null {
  const pending = pendingBonuses(sheet);
  if (pending.length === 0) return null;
  const done = (b: Bonus, next: Sheet = sheet): void => apply(s, { ...next, bonusDone: [...next.bonusDone, b.id] });

  return h(
    'div',
    { class: 'gsc-pending', role: 'status' },
    h('strong', null, '🎁 Openstaande bonussen'),
    h(
      'div',
      { class: 'gsc-pending-list' },
      pending.map((b) => {
        const value = b.kind === 'orange4' ? 4 : b.kind === 'orange5' ? 5 : b.kind === 'orange6' ? 6 : b.kind === 'purple6' ? 6 : null;
        const isOrange = b.kind.startsWith('orange');
        let action: HTMLElement;
        if (value !== null) {
          // Getal-bonus: met één tik invullen in het volgende vakje
          action = h(
            'button',
            {
              type: 'button',
              class: 'btn-primary',
              onclick: () => {
                if (isOrange) {
                  if (sheet.orange.length >= 11) return toast('Oranje is al vol');
                  done(b, { ...sheet, orange: [...sheet.orange, value] });
                } else {
                  if (sheet.purple.length >= 11) return toast('Paars is al vol');
                  done(b, { ...sheet, purple: [...sheet.purple, value] });
                }
              },
            },
            'Invullen',
          );
        } else if (b.kind === 'greenX') {
          action = h(
            'button',
            {
              type: 'button',
              class: 'btn-primary',
              onclick: () => {
                if (sheet.green >= 11) return toast('Groen is al vol');
                done(b, { ...sheet, green: sheet.green + 1 });
              },
            },
            'Kruisen',
          );
        } else {
          action = h('button', { type: 'button', onclick: () => done(b) }, '✓ Gedaan');
        }
        return h(
          'div',
          { class: 'gsc-pending-item' },
          bonusTag(b.kind, true),
          h('span', { class: 'gsc-pending-text' }, h('b', null, bonusLabel(b.kind)), h('small', null, `${bonusHelp(b.kind)} (uit ${b.from})`)),
          action,
        );
      }),
    ),
  );
}

/* ---------- Bovenkant: rondes, herworpen, +1 ---------- */

function topView(s: GscState, sheet: Sheet): HTMLElement {
  const limit = maxRounds(s.playerCount);
  const rounds = ROUND_BONUS.map((kind, i) =>
    h(
      'button',
      {
        type: 'button',
        class: `s-round${i < s.rounds ? ' done' : ''}${i === s.rounds - 1 ? ' current' : ''}${i >= limit ? ' off' : ''}`,
        disabled: i >= limit,
        'aria-label': `Ronde ${i + 1}${i >= limit ? ' (niet bij dit aantal spelers)' : ''}`,
        onclick: () => {
          const next = i + 1 === s.rounds ? i : i + 1;
          apply(s, { ...sheet, rounds: next });
          if (next === limit) toast(`Laatste ronde (${limit})! Na deze ronde is het spel voorbij.`, 3500);
        },
      },
      h('span', { class: 's-round-nr' }, i + 1),
      kind ? bonusTag(kind, i < s.rounds) : h('span', { class: 's-players', title: i === 4 ? 'Ronde 5 bij 1–3 spelers' : 'Ronde 6 bij 1–2 spelers' }, i === 4 ? '👤👤👤' : '👤👤'),
    ),
  );

  const track = (label: string, icon: string, earned: number, used: number, key: 'rerollsUsed' | 'plusUsed'): HTMLElement =>
    h(
      'div',
      { class: 's-track' },
      h('span', { class: 's-track-icon', title: label }, icon),
      Array.from({ length: TRACK_SIZE }, (_, i) => {
        const available = i < earned;
        const isUsed = i < used;
        return h('button', {
          type: 'button',
          class: `s-dot${available ? ' earned' : ''}${isUsed ? ' used' : ''}`,
          disabled: !available,
          title: isUsed ? 'Gebruikt (tik om terug te zetten)' : available ? 'Beschikbaar: tik als je hem gebruikt' : 'Nog niet verdiend',
          'aria-label': `${label} ${i + 1}${isUsed ? ' gebruikt' : available ? ' beschikbaar' : ''}`,
          onclick: () => apply(s, { ...sheet, [key]: isUsed ? i : i + 1 }),
        });
      }),
    );

  return h(
    'div',
    { class: 's-top' },
    h('div', { class: 's-rounds' }, rounds),
    track('Herworp', ICON_REROLL, countKind(sheet, 'reroll'), s.rerollsUsed, 'rerollsUsed'),
    track('+1', '+1', countKind(sheet, 'plus'), s.plusUsed, 'plusUsed'),
  );
}

/* ---------- Geel ---------- */

function yellowView(s: GscState, sheet: Sheet, earned: Set<string>): HTMLElement {
  const grid = h('div', { class: 's-ygrid' });
  YELLOW_VALUES.forEach((row, r) => {
    row.forEach((value, c) => {
      const preset = YELLOW_PRESET(r, c);
      const crossed = yellowCrossed(sheet, r, c);
      grid.append(
        h(
          'button',
          {
            type: 'button',
            class: `s-cell${crossed ? ' crossed' : ''}${preset ? ' preset' : ''}`,
            disabled: preset,
            'aria-label': preset ? 'Al afgekruist' : `Geel ${value}`,
            onclick: () => {
              const yellow = [...sheet.yellow];
              yellow[r * 4 + c] = !yellow[r * 4 + c];
              apply(s, { ...sheet, yellow });
            },
          },
          preset ? '' : value,
        ),
      );
    });
    grid.append(h('span', { class: 's-arrow' }, '→', bonusTag(YELLOW_ROW_BONUS[r] ?? 'fox', earned.has(`y-r${r}`))));
  });
  YELLOW_COL_POINTS.forEach((pts, c) => {
    const full = [0, 1, 2, 3].every((r) => yellowCrossed(sheet, r, c));
    grid.append(h('span', { class: 's-down' }, h('i', null, '↓'), h('span', { class: `s-burst yellow${full ? ' lit' : ''}` }, pts)));
  });
  grid.append(h('span', { class: 's-down diag' }, h('i', null, '↘'), bonusTag(YELLOW_DIAGONAL_BONUS, earned.has('y-diag'))));

  return h('section', { class: 's-area yellow', title: 'Geel: kruis de waarde van de gele steen' }, grid);
}

/* ---------- Blauw ---------- */

function blueView(s: GscState, sheet: Sheet, earned: Set<string>): HTMLElement {
  const count = sheet.blue.length;
  const scale = h(
    'div',
    { class: 's-scale' },
    BLUE_POINTS.slice(1).map((pts, i) =>
      h(
        'span',
        { class: `s-scale-col${i + 1 === count ? ' now' : ''}` },
        h('span', { class: `s-burst blue small${i + 1 <= count ? ' lit' : ''}` }, pts),
        h('small', null, i + 1),
      ),
    ),
  );

  const grid = h('div', { class: 's-bgrid' });
  BLUE_GRID.forEach((row, r) => {
    row.forEach((value) => {
      if (value === null) {
        grid.append(h('span', { class: 's-bicon', title: 'Blauw + wit' }, h('i', { class: 'b' }), '+', h('i', { class: 'w' })));
        return;
      }
      const crossed = sheet.blue.includes(value);
      grid.append(
        h(
          'button',
          {
            type: 'button',
            class: `s-cell${crossed ? ' crossed' : ''}`,
            'aria-label': `Blauw ${value}`,
            onclick: () => apply(s, { ...sheet, blue: crossed ? sheet.blue.filter((v) => v !== value) : [...sheet.blue, value] }),
          },
          value,
        ),
      );
    });
    grid.append(h('span', { class: 's-arrow' }, '→', bonusTag(BLUE_ROW_BONUS[r] ?? 'fox', earned.has(`b-r${r}`))));
  });
  BLUE_COL_BONUS.forEach((kind, c) => grid.append(h('span', { class: 's-down' }, h('i', null, '↓'), bonusTag(kind, earned.has(`b-c${c}`)))));
  grid.append(h('span'));

  return h('section', { class: 's-area blue', title: 'Blauw: kruis de som van blauw + wit' }, scale, grid);
}

/* ---------- Groen, oranje, paars (van links naar rechts) ---------- */

function lane(area: 'green' | 'orange' | 'purple', title: string, cells: HTMLElement[], top?: HTMLElement): HTMLElement {
  return h(
    'section',
    { class: `s-area s-lane ${area}`, title },
    top ?? null,
    h('div', { class: 's-row' }, h('span', { class: 's-start', 'aria-hidden': 'true' }, '➜'), cells),
  );
}

function greenView(s: GscState, sheet: Sheet): HTMLElement {
  const top = h(
    'div',
    { class: 's-row s-row-top' },
    h('span'),
    GREEN_POINTS.slice(1).map((pts, i) => h('span', { class: `s-burst green small${i < sheet.green ? ' lit' : ''}${i + 1 === sheet.green ? ' now' : ''}` }, pts)),
  );
  const cells = GREEN_MIN.map((min, i) => {
    const filled = i < sheet.green;
    const bonus = GREEN_BONUS[i];
    return h(
      'button',
      {
        type: 'button',
        class: `s-cell${filled ? ' crossed' : ''}${i === sheet.green ? ' next' : ''}`,
        'aria-label': `Groen vakje ${i + 1}, minstens ${min}`,
        onclick: (e: Event) => {
          if (filled) return toast('Vergist? Gebruik ↶');
          if (i !== sheet.green) {
            shake(e.currentTarget as HTMLElement);
            return toast('Groen vul je van links naar rechts in');
          }
          apply(s, { ...sheet, green: sheet.green + 1 });
        },
      },
      h('span', { class: 's-hint' }, `≥${min}`),
      bonus ? h('span', { class: 's-under' }, bonusTag(bonus, filled)) : null,
    );
  });
  return lane('green', 'Groen: steen moet minstens het getal in het vakje zijn', cells, top);
}

function orangeView(s: GscState, sheet: Sheet): HTMLElement {
  const cells = ORANGE_MULT.map((mult, i) => {
    const value = sheet.orange[i];
    const bonus = ORANGE_BONUS[i];
    return h(
      'button',
      {
        type: 'button',
        class: `s-cell value${value !== undefined ? ' filled' : ''}${i === sheet.orange.length ? ' next' : ''}`,
        'aria-label': `Oranje vakje ${i + 1}${mult > 1 ? ` (×${mult})` : ''}`,
        onclick: (e: Event) => {
          if (value !== undefined) return toast('Vergist? Gebruik ↶');
          if (i !== sheet.orange.length) {
            shake(e.currentTarget as HTMLElement);
            return toast('Oranje vul je van links naar rechts in');
          }
          pickNumber(
            `Oranje${mult > 1 ? ` (telt ×${mult})` : ''}`,
            () => true,
            (n) => apply(s, { ...sheet, orange: [...sheet.orange, n] }),
            undefined,
            valueBonus(sheet, 'orange'),
          );
        },
      },
      value === undefined && i === sheet.orange.length && valueBonus(sheet, 'orange')
        ? h('span', { class: 's-bonusnext', title: 'Openstaande bonus' }, `🎁${valueBonus(sheet, 'orange')}`)
        : value !== undefined
          ? h('span', { class: 's-val' }, value)
          : mult > 1
            ? h('span', { class: 's-hint' }, `×${mult}`)
            : null,
      value !== undefined && mult > 1 ? h('span', { class: 's-mult', title: `telt ×${mult} = ${value * mult}` }, `×${mult}`) : null,
      bonus ? h('span', { class: 's-under' }, bonusTag(bonus, value !== undefined)) : null,
    );
  });
  return lane('orange', 'Oranje: vul de waarde in; ×2/×3 telt dubbel/drie keer', cells);
}

function purpleView(s: GscState, sheet: Sheet): HTMLElement {
  const cells = Array.from({ length: 11 }, (_, i) => {
    const value = sheet.purple[i];
    const bonus = PURPLE_BONUS[i];
    return h(
      'button',
      {
        type: 'button',
        class: `s-cell value${value !== undefined ? ' filled' : ''}${i === sheet.purple.length ? ' next' : ''}`,
        'aria-label': `Paars vakje ${i + 1}`,
        onclick: (e: Event) => {
          if (value !== undefined) return toast('Vergist? Gebruik ↶');
          if (i !== sheet.purple.length) {
            shake(e.currentTarget as HTMLElement);
            return toast('Paars vul je van links naar rechts in');
          }
          const prev = sheet.purple[i - 1];
          pickNumber(
            prev === undefined || prev === 6 ? 'Paars' : `Paars: hoger dan ${prev}`,
            (n) => purpleAllowed(sheet, n),
            (n) => apply(s, { ...sheet, purple: [...sheet.purple, n] }),
            undefined,
            valueBonus(sheet, 'purple'),
          );
        },
      },
      i > 0 ? h('span', { class: 's-lt', 'aria-hidden': 'true' }, '<') : null,
      value !== undefined ? h('span', { class: 's-val' }, value) : null,
      value === undefined && i === sheet.purple.length && valueBonus(sheet, 'purple')
        ? h('span', { class: 's-bonusnext', title: 'Openstaande bonus' }, `🎁${valueBonus(sheet, 'purple')}`)
        : null,
      bonus ? h('span', { class: 's-under' }, bonusTag(bonus, value !== undefined)) : null,
    );
  });
  return lane('purple', 'Paars: steeds hoger; na een 6 mag weer alles', cells);
}

/* ---------- Score ---------- */

function scoreView(r: ReturnType<typeof score>): HTMLElement {
  const box = (label: string, value: number, color: string, extra = ''): HTMLElement =>
    h('div', { class: `gsc-score-box ${extra}`, style: `--area:${color}` }, h('small', null, label), h('b', null, value));
  return h(
    'div',
    { class: 'gsc-score' },
    box('Geel', r.yellow, AREA_COLORS.yellow),
    h('span', { class: 'op' }, '+'),
    box('Blauw', r.blue, AREA_COLORS.blue),
    h('span', { class: 'op' }, '+'),
    box('Groen', r.green, AREA_COLORS.green),
    h('span', { class: 'op' }, '+'),
    box('Oranje', r.orange, AREA_COLORS.orange),
    h('span', { class: 'op' }, '+'),
    box('Paars', r.purple, AREA_COLORS.purple),
    h('span', { class: 'op' }, '+'),
    h(
      'div',
      { class: 'gsc-score-box fox', style: '--area:#e8472f', title: 'Elke vos is je laagste gebied waard' },
      h('small', null, `🦊 ${r.foxes} × ${r.foxValue}`),
      h('b', null, r.fox),
    ),
    h('span', { class: 'op' }, '='),
    box('Totaal', r.total, '#ffffff', 'total'),
  );
}

/* ---------- Afronden ---------- */

function finishGame(s: GscState): void {
  const total = score(sheetOf(s)).total;
  if (!confirm(`Blad afronden met ${total} punten en opslaan bij "Gespeeld"?`)) return;
  const name = s.player || 'Ik';
  addHistory({ gameId: GAME_ID, title: 'Clever', players: [{ name, score: total }], winners: [name] });
  store.clear();
  state = null;
  render();
  confetti();
  toast(`${total} punten opgeslagen`);
}

function clearGame(): void {
  if (!confirm('Blad wissen zonder op te slaan?')) return;
  store.clear();
  state = null;
  render();
}

render();
