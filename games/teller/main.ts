import { confetti } from '@shared/confetti';
import { h, mount, tallyMarks, toast } from '@shared/dom';
import { addHistory, determineWinners, type PlayerResult, type WinMode } from '@shared/history';
import { initPage } from '@shared/page';
import { getRecentPlayers, rememberPlayers } from '@shared/players';
import { sessionStore } from '@shared/session';
import { readJSON, writeJSON } from '@shared/storage';

/**
 * Algemeen scoreblad, in twee vormen:
 *  - Vrij tellen: per speler punten erbij of eraf, in willekeurige volgorde (moves).
 *  - Per ronde: na elke ronde voor iedereen de punten invullen (rounds), getoond als
 *    het klassieke scoreblokje: oude stand, + punten, streep, nieuwe stand.
 * Scores worden altijd uit de opgeslagen zetten/rondes berekend, zodat ongedaan maken
 * simpelweg de laatste zet of ronde weghalen is.
 */

const GAME_ID = 'teller';
const VERSION = 1;

interface Move {
  player: number;
  delta: number;
}

type Entry = 'vrij' | 'ronde';

interface Settings {
  title: string;
  /** Invoer: vrij tellen of per ronde. */
  entry: Entry;
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
  /** Alleen bij invoer per ronde: rounds[ronde][speler] = punten. */
  rounds?: number[][];
}

const store = sessionStore<CounterState>(GAME_ID, VERSION);
const SETTINGS_KEY = `spel:${GAME_ID}:instellingen`;
const DEFAULT_SETTINGS: Settings = {
  title: '',
  entry: 'vrij',
  players: ['', ''],
  mode: 'hoogste',
  start: 0,
  tally: false,
  target: null,
};

initPage({ root: '../../', keepAwake: true });

const app = mount('#app');
let state: CounterState | null = store.load();

/** Per ronde: welke ronde wordt aangepast (null = nieuwe ronde) en wat er al is ingetypt. */
let editingRound: number | null = null;
let roundDraft: string[] = [];

function render(): void {
  app.replaceChildren(state ? playView(state) : setupView());
}

function update(next: CounterState): void {
  state = next;
  store.save(next);
  render();
}

function isRoundMode(s: CounterState): boolean {
  return (s.entry ?? 'vrij') === 'ronde';
}

function roundsOf(s: CounterState): number[][] {
  return s.rounds ?? [];
}

function hasScores(s: CounterState): boolean {
  return isRoundMode(s) ? roundsOf(s).length > 0 : s.moves.length > 0;
}

function scores(s: CounterState): number[] {
  const totals = s.players.map(() => s.start);
  if (isRoundMode(s)) {
    for (const round of roundsOf(s)) round.forEach((points, p) => (totals[p] = (totals[p] ?? s.start) + points));
  } else {
    for (const move of s.moves) totals[move.player] = (totals[move.player] ?? s.start) + move.delta;
  }
  return totals;
}

/** Tussenstanden per ronde: running[ronde][speler] = stand na die ronde. */
function runningTotals(s: CounterState): number[][] {
  const totals = s.players.map(() => s.start);
  return roundsOf(s).map((round) => {
    round.forEach((points, p) => (totals[p] = (totals[p] ?? s.start) + points));
    return [...totals];
  });
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
    editingRound = null;
    roundDraft = [];
    update({ ...settings, version: VERSION, moves: [], rounds: [] });
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
        h('span', null, 'Hoe tel je?'),
        h(
          'div',
          { class: 'segmented' },
          (['vrij', 'ronde'] as const).map((entry) =>
            h(
              'label',
              null,
              h('input', {
                type: 'radio',
                name: 'entry',
                checked: draft.entry === entry,
                onchange: () => {
                  draft.entry = entry;
                },
              }),
              entry === 'vrij' ? 'Vrij tellen' : 'Per ronde',
            ),
          ),
        ),
        h('small', { class: 'muted' }, 'Per ronde: na elke ronde vul je voor iedereen de punten in, als op een scoreblokje.'),
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
  const leaders = hasScores(s) ? determineWinners(results(s), s.mode) : [];
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
    isRoundMode(s)
      ? roundView(s, leaders, ranking)
      : h(
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
    !isRoundMode(s) && s.moves.length > 0
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
          disabled: isRoundMode(s) ? roundsOf(s).length === 0 : !lastMove,
          'aria-label': isRoundMode(s) ? 'Laatste ronde weghalen' : 'Ongedaan maken',
          title: isRoundMode(s) ? 'Laatste ronde weghalen' : 'Ongedaan maken',
          onclick: () => {
            if (isRoundMode(s)) {
              if (!confirm(`Ronde ${roundsOf(s).length} weghalen?`)) return;
              editingRound = null;
              roundDraft = [];
              update({ ...s, rounds: roundsOf(s).slice(0, -1) });
            } else {
              update({ ...s, moves: s.moves.slice(0, -1) });
            }
          },
        },
        '↶',
      ),
      h('button', { class: 'btn-danger', onclick: () => clearGame() }, 'Wissen'),
      h('button', { class: 'btn-primary', onclick: () => finishGame(s) }, 'Afronden'),
    ),
  );
}

/* ------------------------------------------------------------------ */
/* Per ronde: het scoreblokje                                          */
/* ------------------------------------------------------------------ */

function parsePoints(raw: string): number | null {
  const cleaned = raw.trim().replace('−', '-').replace(',', '.');
  if (cleaned === '' || cleaned === '-') return null;
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : null;
}

function roundView(s: CounterState, leaders: string[], ranking: Map<number, number>): HTMLElement {
  const rounds = roundsOf(s);
  const running = runningTotals(s);
  const totals = scores(s);
  const target = s.target ?? null;

  /* Kop: naam + huidige stand per speler */
  const head = h(
    'tr',
    null,
    h('th', { class: 'rs-corner' }),
    s.players.map((name, p) => {
      const place = ranking.get(p);
      const classes = ['rs-player'];
      if (leaders.includes(name)) classes.push('leader');
      if (place !== undefined) classes.push('reached');
      if (place !== undefined && place <= 3) classes.push(`place-${place}`);
      const score = totals[p] ?? s.start;
      return h(
        'th',
        { class: classes.join(' '), 'data-player': p, scope: 'col' },
        h('span', { class: 'rs-name' }, name),
        place !== undefined ? h('span', { class: 'goal-badge' }, `${medal(place)} ${place}e`) : null,
        h('span', { class: 'rs-total' }, formatScore(score)),
        target !== null
          ? h('span', { class: 'progress', 'aria-hidden': 'true' }, h('span', { style: `width:${Math.round(progress(s, score) * 100)}%` }))
          : null,
      );
    }),
  );

  /* Startregel (de "oude score" van ronde 1) */
  const startRow = h(
    'tr',
    { class: 'rs-start' },
    h('th', { scope: 'row' }, 'Start'),
    s.players.map(() => h('td', null, h('span', { class: 'rs-run' }, formatScore(s.start)))),
  );

  /* Per ronde: + punten, streep, nieuwe stand. Tik om aan te passen. */
  const roundRows = rounds.map((round, r) =>
    h(
      'tr',
      {
        class: `rs-round${editingRound === r ? ' editing' : ''}`,
        title: 'Tik om deze ronde aan te passen',
        onclick: () => {
          editingRound = r;
          roundDraft = round.map((v) => String(v));
          render();
          app.querySelector<HTMLInputElement>('.rs-entry input')?.focus();
        },
      },
      h('th', { scope: 'row' }, `R${r + 1}`),
      round.map((points, p) =>
        h(
          'td',
          null,
          h('span', { class: `rs-delta${points < 0 ? ' neg' : points === 0 ? ' zero' : ''}` }, formatDelta(points)),
          h('span', { class: 'rs-run' }, formatScore(running[r]?.[p] ?? s.start)),
        ),
      ),
    ),
  );

  const table = h(
    'div',
    { class: 'card rs-wrap' },
    h('table', { class: 'rs-table' }, h('thead', null, head), h('tbody', null, startRow, ...roundRows)),
  );

  return h('div', { class: 'rs' }, table, entryCard(s));
}

/** Invoer voor een nieuwe ronde, of voor het aanpassen van een bestaande. */
function entryCard(s: CounterState): HTMLElement {
  const rounds = roundsOf(s);
  const editing = editingRound;
  const roundNr = editing === null ? rounds.length + 1 : editing + 1;
  while (roundDraft.length < s.players.length) roundDraft.push('');

  // Stand vóór deze ronde, om live "= nieuwe stand" te tonen
  const running = runningTotals(s);
  const before = editing === null ? scores(s) : editing === 0 ? s.players.map(() => s.start) : (running[editing - 1] ?? []);

  const fields = s.players.map((name, p) => {
    const preview = h('span', { class: 'rs-preview' });
    const input = h('input', {
      type: 'text',
      inputMode: 'decimal',
      autocomplete: 'off',
      placeholder: '0',
      value: roundDraft[p] ?? '',
      'aria-label': `Punten ronde ${roundNr} voor ${name}`,
      enterkeyhint: p === s.players.length - 1 ? 'done' : 'next',
    });
    const updatePreview = (): void => {
      roundDraft[p] = input.value;
      const pts = parsePoints(input.value) ?? 0;
      preview.textContent = `= ${formatScore((before[p] ?? s.start) + pts)}`;
    };
    input.addEventListener('input', updatePreview);
    input.addEventListener('keydown', (e) => {
      if (e.key !== 'Enter') return;
      e.preventDefault();
      const nextInput = app.querySelectorAll<HTMLInputElement>('.rs-entry input')[p + 1];
      if (nextInput) nextInput.focus();
      else saveRound(s);
    });
    updatePreview();
    // ± knop: op telefoons heeft het cijfertoetsenbord vaak geen minteken
    const flip = h(
      'button',
      {
        type: 'button',
        class: 'rs-flip',
        'aria-label': `${name}: plus of min`,
        onclick: () => {
          const v = input.value.trim();
          input.value = v.startsWith('-') || v.startsWith('−') ? v.slice(1) : `-${v}`;
          updatePreview();
          input.focus();
        },
      },
      '±',
    );
    return h('label', { class: 'rs-field' }, h('span', { class: 'rs-field-name' }, name), h('span', { class: 'rs-input' }, flip, input), preview);
  });

  return h(
    'div',
    { class: `card rs-entry${editing !== null ? ' editing' : ''}` },
    h('h2', null, editing === null ? `Ronde ${roundNr}` : `Ronde ${roundNr} aanpassen`),
    h('div', { class: 'rs-fields' }, fields),
    h(
      'div',
      { class: 'row stretch' },
      editing !== null
        ? h(
            'button',
            {
              type: 'button',
              onclick: () => {
                editingRound = null;
                roundDraft = [];
                render();
              },
            },
            'Annuleren',
          )
        : null,
      h('button', { type: 'button', class: 'btn-primary', onclick: () => saveRound(s) }, editing === null ? `Ronde ${roundNr} opslaan` : 'Wijziging opslaan'),
    ),
  );
}

function saveRound(s: CounterState): void {
  const values = s.players.map((_, p) => parsePoints(roundDraft[p] ?? ''));
  if (values.every((v) => v === null) && !confirm('Niemand heeft punten. Toch een ronde met allemaal 0 opslaan?')) return;
  const points = values.map((v) => v ?? 0);
  const rounds = [...roundsOf(s)];
  if (editingRound === null) rounds.push(points);
  else rounds[editingRound] = points;

  const beforeRanking = goalRanking(s);
  const next: CounterState = { ...s, rounds };
  editingRound = null;
  roundDraft = [];
  update(next);

  const after = goalRanking(next);
  for (const [player, place] of after) {
    if (!beforeRanking.has(player)) celebrate(next, player, place);
  }
}

/** Confetti vanaf de kaart (of kolomkop) van de speler die net het doel haalt. */
function celebrate(s: CounterState, player: number, place: number): void {
  const card = app.querySelector<HTMLElement>(`[data-player="${player}"]`);
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
