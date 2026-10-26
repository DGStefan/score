import { h, mount } from '@shared/dom';
import { GAMES, gameById, type GameInfo } from '@shared/games';
import { clearHistory, getHistory, removeHistory, type HistoryEntry } from '@shared/history';
import { initPage } from '@shared/page';
import { hasActiveSession } from '@shared/session';

initPage({ root: '' });

const app = mount('#app');
const dateFormat = new Intl.DateTimeFormat('nl-NL', {
  weekday: 'short',
  day: 'numeric',
  month: 'short',
  hour: '2-digit',
  minute: '2-digit',
});

function render(): void {
  app.replaceChildren(
    h('h1', null, 'Scores'),
    h('p', { class: 'muted' }, 'Kies een spel of een scoreblad.'),
    h('div', { class: 'games' }, GAMES.map(gameCard)),
    historySection(),
  );
}

function gameCard(game: GameInfo): HTMLElement {
  const content = [
    h('span', { class: 'icon' }, game.icon),
    h('h3', null, game.name),
    h('p', { class: 'muted' }, game.description),
  ];
  if (game.status === 'binnenkort') {
    return h('div', { class: 'card game-card disabled' }, ...content, h('span', { class: 'badge soon' }, 'binnenkort'));
  }
  return h(
    'a',
    { class: 'card game-card', href: `games/${game.id}/` },
    ...content,
    hasActiveSession(game.id) ? h('span', { class: 'badge' }, 'bezig') : null,
  );
}

function historySection(): HTMLElement {
  const entries = getHistory();
  return h(
    'section',
    null,
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
      : h('ul', { class: 'history' }, entries.map(historyItem)),
  );
}

function historyItem(entry: HistoryEntry): HTMLElement {
  const game = gameById(entry.gameId);
  const sorted = [...entry.players].sort((a, b) => b.score - a.score);
  return h(
    'li',
    { class: 'card' },
    h(
      'div',
      null,
      h('strong', null, entry.title || game?.name || entry.gameId),
      h(
        'div',
        { class: 'meta muted' },
        `${game?.name ?? entry.gameId} · ${dateFormat.format(new Date(entry.finishedAt))}`,
      ),
      h(
        'div',
        { class: 'scores' },
        sorted.map((p, i) => [
          i > 0 ? ' · ' : null,
          h('span', { class: entry.winners.includes(p.name) ? 'winner' : '' }, `${p.name} ${p.score}`),
        ]).flat(),
      ),
    ),
    h(
      'button',
      {
        class: 'btn-ghost',
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
