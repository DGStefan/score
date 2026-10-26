import '@fontsource/fredoka/latin-500.css';
import '@fontsource/fredoka/latin-600.css';
import '@fontsource/fredoka/latin-700.css';
import { confetti } from '@shared/confetti';
import { h, mount, toast } from '@shared/dom';
import { addHistory } from '@shared/history';
import { initPage } from '@shared/page';
import { getRecentPlayers, rememberPlayers } from '@shared/players';
import { sessionStore } from '@shared/session';
import { readJSON, writeJSON } from '@shared/storage';
import {
  MAKI_CHOICES,
  PUDDING_CHOICES,
  cardPoints,
  emptyCards,
  openSets,
  type CardKey,
  type Cards,
} from './scoring';
import './sushi-go.css';

/**
 * Sushi Go!: je eigen scorekaart op je eigen tablet of telefoon.
 * Per ronde tel je je kaarten; de app rekent sets, gyoza en nigiri uit.
 * Maki en pudding hangen af van de andere spelers: daar kies je zelf je punten.
 */

const GAME_ID = 'sushi-go';
const VERSION = 2;
const ROUNDS = 3;
const TABS = ['Ronde 1', 'Ronde 2', 'Ronde 3', 'Pudding', 'Totaal'] as const;
const TABS_SHORT = ['R1', 'R2', 'R3', '🍮', 'Totaal'] as const;
const PUDDING_TAB = 3;
const TOTAL_TAB = 4;

interface Round {
  cards: Cards;
  /** Gekozen maki-punten (6, 3, of gedeeld). */
  maki: number;
}

interface SushiState {
  version: typeof VERSION;
  player: string;
  rounds: Round[];
  puddingCount: number;
  puddingPoints: number;
  tab: number;
}

interface CardRow {
  key: CardKey;
  label: string;
  icon: string;
  color: string;
  hint: string;
}

const SET_ROWS: CardRow[] = [
  { key: 'tempura', label: 'Tempura', icon: '🍤', color: '#b38ad8', hint: 'set van 2 = 5' },
  { key: 'sashimi', label: 'Sashimi', icon: '🐟', color: '#b9d43f', hint: 'set van 3 = 10' },
  { key: 'gyoza', label: 'Gyoza', icon: '🥟', color: '#5f9fe0', hint: '1 · 3 · 6 · 10 · 15' },
];

const NIGIRI_ROWS: { plain: CardKey; wasabi: CardKey; label: string; icon: string; points: number }[] = [
  { plain: 'egg', wasabi: 'eggWasabi', label: 'Ei', icon: '🥚', points: 1 },
  { plain: 'salmon', wasabi: 'salmonWasabi', label: 'Zalm', icon: '🍣', points: 2 },
  { plain: 'squid', wasabi: 'squidWasabi', label: 'Inktvis', icon: '🦑', points: 3 },
];

const store = sessionStore<SushiState>(GAME_ID, VERSION);
const LAST_KEY = `spel:${GAME_ID}:speler`;

initPage({ root: '../../', keepAwake: true });
document.body.classList.add('sg-page');

const app = mount('#app');
let state: SushiState | null = store.load();

function render(): void {
  app.replaceChildren(state ? playView(state) : setupView());
}

function update(next: SushiState): void {
  state = next;
  store.save(next);
  render();
}

function roundTotal(r: Round): number {
  return cardPoints(r.cards, r.maki).total;
}

function grandTotal(s: SushiState): number {
  return s.rounds.reduce((sum, r) => sum + roundTotal(r), 0) + s.puddingPoints;
}

function signed(n: number): string {
  return n > 0 ? `+${n}` : n < 0 ? `−${-n}` : '0';
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
  const recent = h(
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
  );

  const start = (e: Event): void => {
    e.preventDefault();
    const name = player.trim();
    writeJSON(LAST_KEY, name);
    if (name) rememberPlayers([name]);
    update({
      version: VERSION,
      player: name,
      rounds: Array.from({ length: ROUNDS }, () => ({ cards: emptyCards(), maki: 0 })),
      puddingCount: 0,
      puddingPoints: 0,
      tab: 0,
    });
  };

  return h(
    'form',
    { class: 'sg', onsubmit: start },
    h('div', { class: 'topbar' }, h('a', { class: 'btn btn-ghost', href: '../../' }, '‹'), h('h1', null, 'Sushi Go!')),
    h(
      'div',
      { class: 'card sg-intro' },
      h('p', null, 'Je eigen scorekaart: iedereen houdt zijn eigen score bij op zijn eigen scherm.'),
      h('label', { class: 'field' }, h('span', null, 'Wie ben je?'), nameInput, recent),
    ),
    h('div', { class: 'actions row stretch' }, h('button', { type: 'submit', class: 'btn-primary btn-big' }, 'Aan tafel!')),
  );
}

/* ------------------------------------------------------------------ */
/* Spelen                                                              */
/* ------------------------------------------------------------------ */

function stepper(value: number, onChange: (v: number) => void, label: string): HTMLElement {
  return h(
    'div',
    { class: 'stepper' },
    h('button', { type: 'button', class: 'btn-minus', 'aria-label': `${label} min`, disabled: value <= 0, onclick: () => onChange(value - 1) }, '−'),
    h('span', { class: value > 0 ? 'value' : 'value zero' }, value),
    h('button', { type: 'button', class: 'btn-primary', 'aria-label': `${label} plus`, onclick: () => onChange(value + 1) }, '+'),
  );
}

function choiceChips(options: readonly number[], selected: number, onPick: (v: number) => void, label: string): HTMLElement {
  return h(
    'div',
    { class: 'sg-choices', role: 'radiogroup', 'aria-label': label },
    options.map((v) =>
      h(
        'button',
        {
          type: 'button',
          role: 'radio',
          'aria-checked': String(v === selected),
          class: `sg-choice${v === selected ? ' active' : ''}${v < 0 ? ' neg' : ''}`,
          onclick: () => onPick(v),
        },
        v > 0 && options.some((o) => o < 0) ? `+${v}` : v < 0 ? `−${-v}` : String(v),
      ),
    ),
  );
}

function tile(icon: string, color: string): HTMLElement {
  return h('span', { class: 'sg-tile', style: `--chip:${color}` }, icon);
}

function playView(s: SushiState): HTMLElement {
  const tabs = h(
    'nav',
    { class: 'sg-tabs', role: 'tablist' },
    TABS.map((label, i) =>
      h(
        'button',
        {
          type: 'button',
          role: 'tab',
          class: i === s.tab ? 'active' : '',
          'aria-selected': String(i === s.tab),
          onclick: () => update({ ...s, tab: i }),
        },
        h('span', { class: 'long' }, label),
        h('span', { class: 'short' }, TABS_SHORT[i] ?? label),
      ),
    ),
  );

  let body: HTMLElement;
  if (s.tab < ROUNDS) body = roundView(s, s.tab);
  else if (s.tab === PUDDING_TAB) body = puddingView(s);
  else body = totalView(s);

  const next =
    s.tab < TOTAL_TAB
      ? h('button', { class: 'btn-primary', onclick: () => update({ ...s, tab: s.tab + 1 }) }, `${TABS[s.tab + 1] ?? ''} ›`)
      : h('button', { class: 'btn-primary', onclick: () => finishGame(s) }, 'Afronden');

  return h(
    'div',
    { class: 'sg' },
    h(
      'div',
      { class: 'topbar' },
      h('a', { class: 'btn btn-ghost', href: '../../' }, '‹'),
      h('h1', null, 'Sushi Go!'),
      s.player ? h('span', { class: 'sg-player-name' }, s.player) : null,
    ),
    tabs,
    h('div', { class: 'sg-layout' }, body, scoreCard(s)),
    h('div', { class: 'actions row stretch' }, h('button', { class: 'btn-danger', onclick: () => clearGame() }, 'Wissen'), next),
  );
}

/** Scorekaart: altijd zichtbaar overzicht van rondes, pudding en totaal. */
function scoreCard(s: SushiState): HTMLElement {
  const rows: [string, number, number][] = [
    ...s.rounds.map((r, i): [string, number, number] => [`Ronde ${i + 1}`, roundTotal(r), i]),
    ['Pudding', s.puddingPoints, PUDDING_TAB],
  ];
  return h(
    'aside',
    { class: 'card sg-scorecard' },
    h('h3', null, 'Scorekaart'),
    rows.map(([label, value, tab]) =>
      h(
        'button',
        { type: 'button', class: `sg-sc-row${tab === s.tab ? ' current' : ''}`, onclick: () => update({ ...s, tab }) },
        h('span', null, label),
        h('span', { class: 'v' }, tab === PUDDING_TAB ? signed(value) : value),
      ),
    ),
    h(
      'button',
      { type: 'button', class: `sg-sc-row total${s.tab === TOTAL_TAB ? ' current' : ''}`, onclick: () => update({ ...s, tab: TOTAL_TAB }) },
      h('span', null, 'Totaal'),
      h('span', { class: 'v' }, grandTotal(s)),
    ),
  );
}

function roundView(s: SushiState, index: number): HTMLElement {
  const round = s.rounds[index] ?? { cards: emptyCards(), maki: 0 };
  const c = round.cards;
  const points = cardPoints(c, round.maki);
  const setRound = (next: Round): void => update({ ...s, rounds: s.rounds.map((r, i) => (i === index ? next : r)) });
  const setCard = (key: CardKey, value: number): void => setRound({ ...round, cards: { ...c, [key]: Math.max(0, value) } });
  const hints = openSets(c);
  const setPoints: Record<string, number> = { tempura: points.tempura, sashimi: points.sashimi, gyoza: points.gyoza };

  return h(
    'section',
    { class: 'card sg-sheet' },
    h('header', null, h('h2', null, `Ronde ${index + 1}`), h('span', { class: 'sg-score' }, points.total)),
    h(
      'div',
      { class: 'sg-groups' },
      h(
        'div',
        { class: 'sg-group' },
        // Maki: aantal zelf bijhouden, punten kiezen na vergelijken met de anderen
        h(
          'div',
          { class: 'sg-maki' },
          h(
            'div',
            { class: 'sg-row' },
            tile('🍥', '#e2403f'),
            h('span', { class: 'sg-label' }, 'Maki', h('small', null, 'tel je rolletjes')),
            stepper(c.maki, (v) => setCard('maki', v), 'Maki'),
            h('span', { class: 'sg-pts' }, round.maki),
          ),
          h(
            'div',
            { class: 'sg-maki-pick' },
            h('span', null, 'Punten na vergelijken:'),
            choiceChips(MAKI_CHOICES, round.maki, (v) => setRound({ ...round, maki: v }), 'Maki-punten'),
            h('small', null, 'Meeste 6 · tweede 3 · gelijk = delen (6÷2 = 3, 6÷3 = 2, 3÷2 = 1)'),
          ),
        ),
        SET_ROWS.map((row) =>
          h(
            'div',
            { class: 'sg-row' },
            tile(row.icon, row.color),
            h('span', { class: 'sg-label' }, row.label, h('small', null, row.hint)),
            stepper(c[row.key], (v) => setCard(row.key, v), row.label),
            h('span', { class: 'sg-pts' }, setPoints[row.key] ?? 0),
          ),
        ),
        hints.length > 0 ? h('p', { class: 'sg-hint' }, hints.join(' · ')) : null,
      ),
      h(
        'div',
        { class: 'sg-group sg-nigiri' },
        h('div', { class: 'sg-nigiri-head' }, h('span', null, 'Nigiri'), h('span', null, 'los'), h('span', { class: 'wasabi' }, 'op wasabi ×3')),
        NIGIRI_ROWS.map((row) =>
          h(
            'div',
            { class: 'sg-row nigiri' },
            tile(row.icon, '#f6c337'),
            h('span', { class: 'sg-label' }, row.label, h('small', null, `${row.points} pt`)),
            stepper(c[row.plain], (v) => setCard(row.plain, v), row.label),
            stepper(c[row.wasabi], (v) => setCard(row.wasabi, v), `${row.label} op wasabi`),
          ),
        ),
        h('div', { class: 'sg-nigiri-total' }, h('span', null, 'Nigiri totaal'), h('span', { class: 'sg-pts' }, points.nigiri)),
      ),
    ),
  );
}

function puddingView(s: SushiState): HTMLElement {
  return h(
    'section',
    { class: 'card sg-sheet' },
    h('header', null, h('h2', null, 'Pudding'), h('span', { class: `sg-score ${s.puddingPoints > 0 ? 'pos' : s.puddingPoints < 0 ? 'neg' : ''}` }, signed(s.puddingPoints))),
    h(
      'div',
      { class: 'sg-row' },
      tile('🍮', '#f4a0b4'),
      h('span', { class: 'sg-label' }, 'Pudding', h('small', null, 'aantal na 3 rondes')),
      stepper(s.puddingCount, (v) => update({ ...s, puddingCount: Math.max(0, v) }), 'Pudding'),
      h('span'),
    ),
    h(
      'div',
      { class: 'sg-maki-pick' },
      h('span', null, 'Punten na vergelijken:'),
      choiceChips(PUDDING_CHOICES, s.puddingPoints, (v) => update({ ...s, puddingPoints: v }), 'Pudding-punten'),
      h('small', null, 'Meeste +6 · minste −6 · gelijk = delen · met 2 spelers geen minpunten'),
    ),
  );
}

function totalView(s: SushiState): HTMLElement {
  const total = grandTotal(s);
  return h(
    'section',
    { class: 'card sg-sheet sg-total' },
    h('h2', null, s.player ? `${s.player}, je eindscore` : 'Je eindscore'),
    h('div', { class: 'sg-big' }, total),
    h(
      'div',
      { class: 'sg-sum' },
      s.rounds.map((r, i) => h('div', null, h('small', null, `Ronde ${i + 1}`), h('strong', null, roundTotal(r)))),
      h('div', null, h('small', null, 'Pudding'), h('strong', null, signed(s.puddingPoints))),
    ),
    h('p', { class: 'muted' }, 'Gelijke stand met iemand? Dan wint wie de meeste pudding heeft.'),
  );
}

function finishGame(s: SushiState): void {
  const total = grandTotal(s);
  if (!confirm(`Scorekaart afronden met ${total} punten en opslaan bij "Gespeeld"?`)) return;
  const name = s.player || 'Ik';
  addHistory({ gameId: GAME_ID, title: 'Sushi Go!', players: [{ name, score: total }], winners: [name] });
  store.clear();
  state = null;
  render();
  confetti();
  toast(`${total} punten opgeslagen`);
}

function clearGame(): void {
  if (!confirm('Scorekaart wissen zonder op te slaan?')) return;
  store.clear();
  state = null;
  render();
}

render();
