import { h, mount } from '@shared/dom';
import { GAMES, KIND_LABELS, gameById, type GameInfo, type GameKind } from '@shared/games';
import { clearHistory, getHistory, removeHistory, type HistoryEntry } from '@shared/history';
import { initPage } from '@shared/page';
import { readJSON, writeJSON } from '@shared/storage';
import { getTheme, setTheme, type Theme } from '@shared/theme';
import { hasActiveSession, sessionUpdatedAt } from '@shared/session';

initPage({ root: '' });

const app = mount('#app');
const HISTORY_PREVIEW = 5;
let showAllHistory = false;

const dateFormat = new Intl.DateTimeFormat('nl-NL', { weekday: 'short', day: 'numeric', month: 'short' });
const timeFormat = new Intl.DateTimeFormat('nl-NL', { hour: '2-digit', minute: '2-digit' });

/** "zojuist", "12 min geleden", "vandaag 20:15", "gisteren 21:03", "za 12 okt" */
function when(ms: number): string {
  const diff = Date.now() - ms;
  if (diff < 60_000) return 'zojuist';
  if (diff < 60 * 60_000) return `${Math.round(diff / 60_000)} min geleden`;
  const date = new Date(ms);
  const today = new Date();
  const dayDiff = Math.round(
    (new Date(today.toDateString()).getTime() - new Date(date.toDateString()).getTime()) / 86_400_000,
  );
  if (dayDiff === 0) return `vandaag ${timeFormat.format(date)}`;
  if (dayDiff === 1) return `gisteren ${timeFormat.format(date)}`;
  return dateFormat.format(date);
}

function gameStyle(game: GameInfo | undefined): string {
  return `--c:${game?.color ?? 'var(--accent)'}`;
}

function render(): void {
  const history = getHistory();
  const playCount = new Map<string, number>();
  for (const e of history) playCount.set(e.gameId, (playCount.get(e.gameId) ?? 0) + 1);

  const parts: (HTMLElement | null)[] = [
    h(
      'header',
      { class: 'portal-head' },
      h('div', null, h('h1', null, 'Scores'), h('p', { class: 'muted' }, 'Kies een spel of een scoreblad.')),
      themeSwitch(),
    ),
    resumeSection(),
    gamesSection(playCount),
    historySection(history),
  ];
  app.replaceChildren(...parts.filter((p): p is HTMLElement => p !== null));
}

/* ---------- Thema ---------- */

const SVG = (path: string): string =>
  `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${path}</svg>`;

const THEME_OPTIONS: { value: Theme; label: string; icon: string }[] = [
  { value: 'auto', label: 'Automatisch (zoals je apparaat)', icon: SVG('<circle cx="12" cy="12" r="8"/><path d="M12 4a8 8 0 0 1 0 16z" fill="currentColor"/>') },
  {
    value: 'licht',
    label: 'Licht',
    icon: SVG('<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>'),
  },
  { value: 'donker', label: 'Donker', icon: SVG('<path d="M20 14.5A8 8 0 0 1 9.5 4 8 8 0 1 0 20 14.5z"/>') },
];

function themeSwitch(): HTMLElement {
  const current = getTheme();
  return h(
    'div',
    { class: 'theme-switch', role: 'group', 'aria-label': 'Thema' },
    THEME_OPTIONS.map((o) =>
      h('button', {
        'aria-label': o.label,
        title: o.label,
        'aria-pressed': String(current === o.value),
        innerHTML: o.icon,
        onclick: () => {
          setTheme(o.value);
          render();
        },
      }),
    ),
  );
}

/* ---------- Verder spelen ---------- */

function resumeSection(): HTMLElement | null {
  const active = GAMES.filter((g) => g.status === 'beschikbaar' && hasActiveSession(g.id))
    .map((g) => ({ game: g, at: sessionUpdatedAt(g.id) }))
    .sort((a, b) => (b.at ?? 0) - (a.at ?? 0));
  if (active.length === 0) return null;

  return h(
    'section',
    { class: 'portal-section' },
    h('h2', null, 'Verder spelen'),
    h(
      'div',
      { class: 'resume-list' },
      active.map(({ game, at }) =>
        h(
          'a',
          { class: 'resume-card', href: `games/${game.id}/`, style: gameStyle(game) },
          h('span', { class: 'game-icon' }, game.icon),
          h(
            'span',
            { class: 'resume-text' },
            h('strong', null, game.name),
            h('span', { class: 'muted' }, at ? `Bezig · ${when(at)}` : 'Bezig'),
          ),
          h('span', { class: 'resume-go', 'aria-hidden': 'true' }, 'Verder ›'),
        ),
      ),
    ),
  );
}

/* ---------- Spellen, met filter op soort ---------- */

type Filter = GameKind | 'alles';
const FILTER_KEY = 'portal:filter';

function gamesSection(playCount: Map<string, number>): HTMLElement {
  const kinds = (Object.keys(KIND_LABELS) as GameKind[]).filter((k) => GAMES.some((g) => g.kind === k));
  let filter = readJSON<Filter>(FILTER_KEY, 'alles');
  if (filter !== 'alles' && !kinds.includes(filter)) filter = 'alles';
  const sorted = [...GAMES].sort((a, b) => a.name.localeCompare(b.name, 'nl', { sensitivity: 'base' }));
  const shown = filter === 'alles' ? sorted : sorted.filter((g) => g.kind === filter);

  const chip = (value: Filter, label: string, count: number): HTMLElement =>
    h(
      'button',
      {
        class: `chip${filter === value ? ' selected' : ''}`,
        'aria-pressed': String(filter === value),
        onclick: () => {
          writeJSON(FILTER_KEY, value);
          render();
        },
      },
      label,
      h('span', { class: 'chip-count' }, String(count)),
    );

  return h(
    'section',
    { class: 'portal-section' },
    h('h2', null, 'Spellen'),
    kinds.length > 1
      ? h(
          'div',
          { class: 'filter-chips', role: 'group', 'aria-label': 'Soort spel' },
          chip('alles', 'Alles', GAMES.length),
          kinds.map((k) => chip(k, KIND_LABELS[k], GAMES.filter((g) => g.kind === k).length)),
        )
      : null,
    h('div', { class: 'tiles' }, shown.map((g) => gameTile(g, playCount.get(g.id) ?? 0))),
  );
}

function gameTile(game: GameInfo, played: number): HTMLElement {
  const disabled = game.status === 'binnenkort';
  const active = !disabled && hasActiveSession(game.id);

  const status = disabled
    ? h('span', { class: 'pill soon' }, 'binnenkort')
    : active
      ? h('span', { class: 'pill live' }, 'bezig')
      : played > 0
        ? h('span', { class: 'tile-count muted' }, `${played}× gespeeld`)
        : null;

  const content = [
    h('span', { class: 'game-icon' }, game.icon),
    h('h3', null, game.name),
    h('p', { class: 'muted' }, game.description),
    status ? h('div', { class: 'tile-foot' }, status) : null,
  ];

  return disabled
    ? h('div', { class: 'tile disabled', style: gameStyle(game) }, ...content)
    : h('a', { class: `tile${active ? ' is-active' : ''}`, href: `games/${game.id}/`, style: gameStyle(game) }, ...content);
}

/* ---------- Geschiedenis ---------- */

function historySection(entries: HistoryEntry[]): HTMLElement {
  const shown = showAllHistory ? entries : entries.slice(0, HISTORY_PREVIEW);
  return h(
    'section',
    { class: 'portal-section' },
    h(
      'div',
      { class: 'row' },
      h('h2', { style: 'flex:1' }, 'Gespeeld'),
      entries.length > 0
        ? h(
            'button',
            {
              class: 'btn-ghost btn-danger',
              onclick: () => {
                if (confirm('Hele geschiedenis wissen?')) {
                  clearHistory();
                  render();
                }
              },
            },
            'Alles wissen',
          )
        : null,
    ),
    entries.length === 0
      ? h('p', { class: 'muted' }, 'Nog geen potjes afgerond.')
      : h('ul', { class: 'history' }, shown.map(historyItem)),
    entries.length > HISTORY_PREVIEW
      ? h(
          'button',
          {
            class: 'btn-ghost history-more',
            onclick: () => {
              showAllHistory = !showAllHistory;
              render();
            },
          },
          showAllHistory ? 'Minder tonen' : `Alles tonen (${entries.length})`,
        )
      : null,
  );
}

function historyItem(entry: HistoryEntry): HTMLElement {
  const game = gameById(entry.gameId);
  const sorted = [...entry.players].sort((a, b) => b.score - a.score);
  const title = entry.title || game?.name || entry.gameId;
  return h(
    'li',
    { class: 'history-item', style: gameStyle(game) },
    h('span', { class: 'game-icon small' }, game?.icon ?? '🎯'),
    h(
      'div',
      { class: 'history-body' },
      h(
        'div',
        { class: 'history-title' },
        h('strong', null, title),
        h('span', { class: 'muted' }, when(new Date(entry.finishedAt).getTime())),
      ),
      title !== game?.name && game ? h('div', { class: 'meta muted' }, game.name) : null,
      h(
        'div',
        { class: 'scores' },
        sorted.map((p) =>
          h(
            'span',
            { class: `score-chip${entry.winners.includes(p.name) ? ' winner' : ''}` },
            entry.winners.includes(p.name) ? '🏆 ' : null,
            `${p.name} `,
            h('b', null, String(p.score)),
          ),
        ),
      ),
    ),
    h(
      'button',
      {
        class: 'btn-ghost history-del',
        'aria-label': 'Verwijderen',
        onclick: () => {
          if (confirm('Dit potje uit de geschiedenis verwijderen?')) {
            removeHistory(entry.id);
            render();
          }
        },
      },
      '✕',
    ),
  );
}

render();
// Terug naar de portal via de terugknop: stand van "bezig" opnieuw tonen.
window.addEventListener('pageshow', render);
