import { confetti } from '@shared/confetti';
import { h, mount, tallyMarks, toast } from '@shared/dom';
import { addHistory, determineWinners, type PlayerResult, type WinMode } from '@shared/history';
import { initPage } from '@shared/page';
import { getRecentPlayers, rememberPlayers } from '@shared/players';
import { sessionStore } from '@shared/session';
import { readJSON, writeJSON } from '@shared/storage';

/**
 * Algemeen scoreblad: per speler punten erbij of eraf.
 * De stand wordt opgeslagen als lijst zetten (moves); scores worden daaruit berekend.
 * Daardoor is "ongedaan maken" simpelweg de laatste zet weghalen.
 */

const GAME_ID = 'teller';
const VERSION = 1;

interface Move {
  player: number;
  delta: number;
}

interface Settings {
  title: string;
  players: string[];
  mode: WinMode;
  start: number;
  tally: boolean;
  /** Doelscore (drempel). null = geen doel. */
  target: number | null;
}

interface CounterState extends Settings {
  version: typeof VERSION;
  moves: Move[];
}

const store = sessionStore<CounterState>(GAME_ID, VERSION);
const SETTINGS_KEY = `spel:${GAME_ID}:instellingen`;
const DEFAULT_SETTINGS: Settings = { title: '', players: ['', ''], mode: 'hoogste', start: 0, tally: false, target: null };

initPage({ root: '../../', keepAwake: true });

const app = mount('#app');
let state: CounterState | null = store.load();

function render(): void {
  app.replaceChildren(state ? playView(state) : setupView());
}

function update(next: CounterState): void {
  state = next;
  store.save(next);
  render();
}

function scores(s: CounterState): number[] {
  const totals = s.players.map(() => s.start);
  for (const move of s.moves) totals[move.player] = (totals[move.player] ?? s.start) + move.delta;
  return totals;
}

function results(s: CounterState): PlayerResult[] {
  const totals = scores(s);
  return s.players.map((name, i) => ({ name, score: totals[i] ?? s.start }));
}

/** Echt minteken (−) leest beter dan een koppelteken in grote cijfers. */
function formatScore(score: number): string {
  return score < 0 ? `−${Math.abs(score)}` : String(score);
}

/**
 * Doel bereikt? Ligt het doel boven de startscore, dan wordt er opgeteld (score >= doel);
 * ligt het eronder, dan wordt er afgeteld (score <= doel, bijv. 501 → 0).
 */
function reachesTarget(s: CounterState, score: number): boolean {
  const target = s.target ?? null;
  if (target === null) return false;
  return target >= s.start ? score >= target : score <= target;
}

/**
 * Plaats per speler die het doel heeft gehaald (spelerindex → plaats).
 * Niet wie het eerst over de streep ging telt, maar wie er het verst overheen is:
 * bij optellen de hoogste score, bij aftellen de laagste. Gelijke score = gedeelde plaats.
 */
function goalRanking(s: CounterState): Map<number, number> {
  const ranks = new Map<number, number>();
  const target = s.target ?? null;
  if (target === null) return ranks;
  const totals = scores(s);
  const total = (i: number): number => totals[i] ?? s.start;
  const countingUp = target >= s.start;
  const reached = s.players.map((_, i) => i).filter((i) => reachesTarget(s, total(i)));
  reached.sort((a, b) => (countingUp ? total(b) - total(a) : total(a) - total(b)));
  let place = 0;
  reached.forEach((player, index) => {
    const previous = reached[index - 1];
    if (previous === undefined || total(previous) !== total(player)) place = index + 1;
    ranks.set(player, place);
  });
  return ranks;
}

/** Voortgang richting het doel, 0 t/m 1. */
function progress(s: CounterState, score: number): number {
  const target = s.target ?? null;
  if (target === null || target === s.start) return 0;
  return Math.min(1, Math.max(0, (score - s.start) / (target - s.start)));
}

/** Medaille voor plaats 1 t/m 3, daarna een vlag. */
function medal(place: number): string {
  return ['🥇', '🥈', '🥉'][place - 1] ?? '🏁';
}

function formatDelta(delta: number): string {
  return delta > 0 ? `+${delta}` : formatScore(delta);
}

/* ------------------------------------------------------------------ */
/* Instellen                                                           */
/* ------------------------------------------------------------------ */

function setupView(): HTMLElement {
  const draft: Settings = { ...DEFAULT_SETTINGS, ...readJSON<Partial<Settings>>(SETTINGS_KEY, {}) };
  draft.players = [...draft.players];

  const playerList = h('div');
  const recent = h('div', { class: 'chips' });

  const renderPlayers = (focusIndex?: number): void => {
    playerList.replaceChildren(
      ...draft.players.map((name, i) =>
        h(
          'div',
          { class: 'player-setup' },
          h('input', {
            type: 'text',
            value: name,
            placeholder: `Speler ${i + 1}`,
            autocomplete: 'off',
            enterkeyhint: 'next',
            oninput: (e: Event) => {
              draft.players[i] = (e.target as HTMLInputElement).value;
            },
          }),
          h(
            'button',
            {
              type: 'button',
              class: 'btn-ghost',
              'aria-label': 'Speler verwijderen',
              disabled: draft.players.length <= 1,
              onclick: () => {
                draft.players.splice(i, 1);
                renderPlayers();
              },
            },
            '✕',
          ),
        ),
      ),
    );
    if (focusIndex !== undefined) playerList.querySelectorAll('input')[focusIndex]?.focus();

    const used = new Set(draft.players.map((n) => n.trim().toLowerCase()));
    const suggestions = getRecentPlayers().filter((n) => !used.has(n.toLowerCase()));
    recent.replaceChildren(
      ...suggestions.map((name) =>
        h(
          'button',
          {
            type: 'button',
            class: 'chip',
            onclick: () => {
              const empty = draft.players.findIndex((n) => n.trim() === '');
              if (empty >= 0) draft.players[empty] = name;
              else draft.players.push(name);
              renderPlayers();
            },
          },
          `+ ${name}`,
        ),
      ),
    );
  };
  renderPlayers();

  const start = (e: Event): void => {
    e.preventDefault();
    const players = draft.players.map((n) => n.trim()).filter(Boolean);
    if (players.length === 0) {
      toast('Vul minstens één speler in');
      return;
    }
    const settings: Settings = { ...draft, title: draft.title.trim(), players };
    writeJSON(SETTINGS_KEY, settings);
    rememberPlayers(players);
    update({ ...settings, version: VERSION, moves: [] });
  };

  return h(
    'form',
    { onsubmit: start },
    h('div', { class: 'topbar' }, h('a', { class: 'btn btn-ghost', href: '../../' }, '‹ Spellen'), h('h1', null, 'Nieuw scoreblad')),
    h(
      'div',
      { class: 'card' },
      h(
        'label',
        { class: 'field' },
        h('span', null, 'Titel'),
        h('input', {
          type: 'text',
          value: draft.title,
          placeholder: 'Bijv. Klaverjassen, Mölkky…',
          oninput: (e: Event) => {
            draft.title = (e.target as HTMLInputElement).value;
          },
        }),
      ),
      h(
        'div',
        { class: 'field' },
        h('span', null, 'Spelers'),
        playerList,
        h(
          'button',
          {
            type: 'button',
            onclick: () => {
              draft.players.push('');
              renderPlayers(draft.players.length - 1);
            },
          },
          '+ Speler toevoegen',
        ),
        recent,
      ),
      h(
        'div',
        { class: 'field' },
        h('span', null, 'Wie wint?'),
        h(
          'div',
          { class: 'segmented' },
          (['hoogste', 'laagste'] as const).map((mode) =>
            h(
              'label',
              null,
              h('input', {
                type: 'radio',
                name: 'mode',
                checked: draft.mode === mode,
                onchange: () => {
                  draft.mode = mode;
                },
              }),
              mode === 'hoogste' ? 'Hoogste score' : 'Laagste score',
            ),
          ),
        ),
      ),
      h(
        'label',
        { class: 'field' },
        h('span', null, 'Startscore'),
        h('input', {
          type: 'number',
          inputMode: 'numeric',
          value: String(draft.start),
          oninput: (e: Event) => {
            draft.start = Number((e.target as HTMLInputElement).value) || 0;
          },
        }),
      ),
      h(
        'label',
        { class: 'field' },
        h('span', null, 'Doelscore (optioneel)'),
        h('input', {
          type: 'number',
          inputMode: 'numeric',
          placeholder: 'Geen doel',
          value: draft.target === null ? '' : String(draft.target),
          oninput: (e: Event) => {
            const raw = (e.target as HTMLInputElement).value.trim();
            draft.target = raw === '' || !Number.isFinite(Number(raw)) ? null : Number(raw);
          },
        }),
        h(
          'small',
          { class: 'muted' },
          'Ligt het doel onder de startscore, dan tel je af (bijv. start 501, doel 0). Het spel gaat door tot je afrondt.',
        ),
      ),
      h(
        'label',
        { class: 'check' },
        h('input', {
          type: 'checkbox',
          checked: draft.tally,
          onchange: (e: Event) => {
            draft.tally = (e.target as HTMLInputElement).checked;
          },
        }),
        'Turfstreepjes tonen',
      ),
    ),
    h('div', { class: 'actions row stretch' }, h('button', { type: 'submit', class: 'btn-primary btn-big' }, 'Start')),
  );
}

/* ------------------------------------------------------------------ */
/* Spelen                                                              */
/* ------------------------------------------------------------------ */

function playView(s: CounterState): HTMLElement {
  const totals = scores(s);
  const leaders = s.moves.length > 0 ? determineWinners(results(s), s.mode) : [];
  const addMove = (player: number, delta: number): void => {
    if (!Number.isFinite(delta) || delta === 0) return;
    const before = goalRanking(s);
    const next: CounterState = { ...s, moves: [...s.moves, { player, delta }] };
    update(next);
    const after = goalRanking(next);
    const place = after.get(player);
    if (place !== undefined && !before.has(player)) celebrate(next, player, place);
  };
  const lastMove = s.moves.at(-1);
  const ranking = goalRanking(s);
  const target = s.target ?? null;

  return h(
    'div',
    null,
    h(
      'div',
      { class: 'topbar' },
      h('a', { class: 'btn btn-ghost', href: '../../' }, '‹'),
      h('h1', null, s.title || 'Scoreblad'),
      target !== null ? h('span', { class: 'target-pill' }, `doel ${formatScore(target)}`) : null,
    ),
    ranking.size > 0
      ? h(
          'div',
          { class: 'goal-banner', role: 'status' },
          h('strong', null, '🏁 Doel gehaald: '),
          [...ranking].map(([p, place]) => `${medal(place)} ${s.players[p] ?? ''}`).join('  ·  '),
        )
      : null,
    h(
      'div',
      { class: 'players' },
      s.players.map((name, i) => {
        const score = totals[i] ?? s.start;
        const amount = h('input', {
          type: 'number',
          inputMode: 'numeric',
          placeholder: 'aantal',
          'aria-label': `Punten voor ${name}`,
        });
        const applyAmount = (sign: 1 | -1): void => {
          addMove(i, sign * Math.abs(Number(amount.value)));
        };
        amount.addEventListener('keydown', (e) => {
          if (e.key === 'Enter') applyAmount(1);
        });

        const place = ranking.get(i);
        const classes = ['card', 'player'];
        if (leaders.includes(name)) classes.push('leader');
        if (place !== undefined) classes.push('reached');
        if (place !== undefined && place <= 3) classes.push(`place-${place}`);

        return h(
          'div',
          { class: classes.join(' '), 'data-player': i },
          h(
            'div',
            { class: 'player-head' },
            h(
              'span',
              { class: 'player-name' },
              name,
              place !== undefined ? h('span', { class: 'goal-badge', title: 'Doel gehaald' }, `${medal(place)} ${place}e`) : null,
            ),
            h('span', { class: 'player-score' }, formatScore(score)),
          ),
          target !== null
            ? h(
                'div',
                { class: 'progress', 'aria-hidden': 'true' },
                h('span', { style: `width:${Math.round(progress(s, score) * 100)}%` }),
              )
            : null,
          s.tally && score >= 0 && score <= 100 ? tallyMarks(score) : null,
          h(
            'div',
            { class: 'player-row' },
            h('button', { class: 'btn-big btn-minus', onclick: () => addMove(i, -1), 'aria-label': `${name} min 1` }, '−1'),
            h('button', { class: 'btn-big btn-primary', onclick: () => addMove(i, 1), 'aria-label': `${name} plus 1` }, '+1'),
          ),
          h(
            'div',
            { class: 'amount' },
            amount,
            h('button', { class: 'btn-minus', onclick: () => applyAmount(-1), 'aria-label': 'Aftrekken' }, '−'),
            h('button', { class: 'btn-primary', onclick: () => applyAmount(1), 'aria-label': 'Optellen' }, '+'),
          ),
        );
      }),
    ),
    s.moves.length > 0
      ? h(
          'details',
          { class: 'log' },
          h('summary', null, `Verloop (${s.moves.length})`),
          h(
            'ol',
            { reversed: true },
            [...s.moves].reverse().map((m) => h('li', null, `${s.players[m.player] ?? '?'} ${formatDelta(m.delta)}`)),
          ),
        )
      : null,
    h(
      'div',
      { class: 'actions row stretch' },
      h(
        'button',
        {
          class: 'btn-undo',
          disabled: !lastMove,
          'aria-label': 'Ongedaan maken',
          title: 'Ongedaan maken',
          onclick: () => update({ ...s, moves: s.moves.slice(0, -1) }),
        },
        '↶',
      ),
      h('button', { class: 'btn-danger', onclick: () => clearGame() }, 'Wissen'),
      h('button', { class: 'btn-primary', onclick: () => finishGame(s) }, 'Afronden'),
    ),
  );
}

/** Confetti vanaf de kaart van de speler die net het doel haalt. */
function celebrate(s: CounterState, player: number, place: number): void {
  const card = app.querySelector<HTMLElement>(`.player[data-player="${player}"]`);
  const rect = card?.getBoundingClientRect();
  confetti(rect ? { x: rect.left + rect.width / 2, y: rect.top + rect.height / 3 } : {});
  toast(`${medal(place)} ${s.players[player] ?? ''} haalt het doel! (nu ${place}e)`);
}

function finishGame(s: CounterState): void {
  if (!confirm('Potje afronden en opslaan bij "Gespeeld"?')) return;
  const players = results(s);
  // Heeft iemand het doel gehaald, dan wint de nummer 1 daarvan; anders telt "wie wint?".
  const ranking = goalRanking(s);
  const goalWinners = [...ranking].filter(([, place]) => place === 1).map(([p]) => s.players[p] ?? '');
  const winners = goalWinners.length > 0 ? goalWinners : determineWinners(players, s.mode);
  addHistory({ gameId: GAME_ID, title: s.title, players, winners });
  store.clear();
  state = null;
  render();
  toast(winners.length === 1 ? `${winners[0]} wint!` : `Gelijkspel: ${winners.join(' & ')}`);
}

function clearGame(): void {
  if (!confirm('Stand wissen zonder op te slaan?')) return;
  store.clear();
  state = null;
  render();
}

render();
