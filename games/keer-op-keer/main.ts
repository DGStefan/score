import { confetti } from '@shared/confetti';
import { h, mount, toast } from '@shared/dom';
import { addHistory } from '@shared/history';
import { initPage } from '@shared/page';
import { getRecentPlayers, rememberPlayers } from '@shared/players';
import { sessionStore } from '@shared/session';
import { readJSON, writeJSON } from '@shared/storage';
import './keer-op-keer.css';
import { COLOR_ORDER, LAYOUTS, colorsFor, validateLayout, type ColorKey, type Layout } from './layouts';
import { canCross, cellsOf, colorProgress, emptyMarks, isColumnComplete, score, width, type SheetMarks } from './scoring';

/**
 * Keer op Keer: digitaal scoreblad voor één speler (bedoeld voor een tablet).
 * Je zet zelf de kruisjes; de app rekent mee en laat zien wat er vol is,
 * maar controleert geen spelregels.
 */

const GAME_ID = 'keer-op-keer';
const VERSION = 1;

interface KokState extends SheetMarks {
  version: typeof VERSION;
  layoutId: string;
  player: string;
}

/** Ster met witte rand; de vulling neemt de kleur van het vakje over (currentColor). */
const STAR_SVG =
  '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2.6l2.8 5.9 6.4.8-4.7 4.4 1.2 6.4L12 17l-5.7 3.1 1.2-6.4-4.7-4.4 6.4-.8z" fill="currentColor" stroke="#fff" stroke-width="2" stroke-linejoin="round"/></svg>';

const store = sessionStore<KokState>(GAME_ID, VERSION);
const LAST_KEY = `spel:${GAME_ID}:laatste`;

initPage({ root: '../../', keepAwake: true });

const app = mount('#app');
let state: KokState | null = store.load();

function layoutById(id: string): Layout | undefined {
  return LAYOUTS.find((l) => l.id === id);
}

function render(): void {
  const layout = state ? layoutById(state.layoutId) : undefined;
  app.classList.toggle('kok-wide', Boolean(state && layout));
  if (state && layout) app.replaceChildren(playView(state, layout));
  else app.replaceChildren(setupView());
}

/* ------------------------------------------------------------------ */
/* Tussenscherm: blad (variant) kiezen                                 */
/* ------------------------------------------------------------------ */

function setupView(): HTMLElement {
  const last = readJSON<{ layoutId?: string; player?: string }>(LAST_KEY, {});
  let selected = layoutById(last.layoutId ?? '')?.id ?? LAYOUTS[0]?.id ?? '';
  let player = last.player ?? '';

  const nameInput = h('input', {
    type: 'text',
    value: player,
    placeholder: 'Je naam',
    autocomplete: 'off',
    oninput: (e: Event) => {
      player = (e.target as HTMLInputElement).value;
    },
  });

  const list = h('div', { class: 'kok-layouts' });
  const renderList = (): void => {
    list.replaceChildren(
      ...LAYOUTS.map((layout) => {
        const problems = validateLayout(layout);
        return h(
          'label',
          { class: `card kok-layout${selected === layout.id ? ' selected' : ''}` },
          h('input', {
            type: 'radio',
            name: 'layout',
            checked: selected === layout.id,
            disabled: problems.length > 0,
            onchange: () => {
              selected = layout.id;
              renderList();
            },
          }),
          miniPreview(layout),
          h(
            'div',
            null,
            h('strong', null, layout.name),
            h('p', { class: 'muted' }, layout.description),
            problems.length > 0 ? h('p', { class: 'btn-danger' }, `Fout in blad: ${problems[0]}`) : null,
          ),
        );
      }),
    );
  };
  renderList();

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
    const layout = layoutById(selected);
    if (!layout) return;
    const name = player.trim();
    writeJSON(LAST_KEY, { layoutId: layout.id, player: name });
    if (name) rememberPlayers([name]);
    state = { version: VERSION, layoutId: layout.id, player: name, ...emptyMarks(layout) };
    store.save(state);
    render();
  };

  return h(
    'form',
    { onsubmit: start },
    h('div', { class: 'topbar' }, h('a', { class: 'btn btn-ghost', href: '../../' }, '‹ Spellen'), h('h1', null, 'Keer op Keer')),
    h('div', { class: 'field' }, h('span', null, 'Welk blad speel je?'), list),
    h('label', { class: 'field' }, h('span', null, 'Speler (optioneel)'), nameInput, recent),
    h('div', { class: 'actions row stretch' }, h('button', { type: 'submit', class: 'btn-primary btn-big' }, 'Start')),
  );
}

function miniPreview(layout: Layout): HTMLElement {
  const colors = colorsFor(layout);
  const grid = h('div', { class: 'kok-mini', style: `grid-template-columns:repeat(${width(layout)},1fr)` });
  for (const cell of cellsOf(layout)) grid.append(h('i', { style: `background:${colors[cell.color].fill}` }));
  return grid;
}

/* ------------------------------------------------------------------ */
/* Speelblad                                                           */
/* ------------------------------------------------------------------ */

function playView(initial: KokState, layout: Layout): HTMLElement {
  let s = initial;
  const colors = colorsFor(layout);
  const cells = cellsOf(layout);
  const w = width(layout);

  const save = (next: KokState): void => {
    const before = score(layout, s);
    s = next;
    state = next;
    store.save(next);
    refresh();
    const after = score(layout, next);
    for (const c of after.completeColors) {
      if (!before.completeColors.includes(c)) {
        confetti();
        toast(`${colors[c].name} is vol!`);
      }
    }
  };

  /* --- Raster --- */
  const sheet = h('div', { class: 'kok-sheet', style: `--cols:${w}` });

  const headers = layout.columnPoints.map((_, col) =>
    h('div', { class: col === layout.startColumn ? 'kok-head start' : 'kok-head' }, layout.columnLabels[col] ?? ''),
  );
  sheet.append(...headers);

  const cellButtons = cells.map((cell) => {
    const info = colors[cell.color];
    return h(
      'button',
      {
        type: 'button',
        class: `kok-cell${cell.star ? ' star' : ''}${cell.col === layout.startColumn ? ' start' : ''}`,
        style: `--fill:${info.fill};--ink:${info.ink}`,
        'aria-label': `${layout.columnLabels[cell.col] ?? ''}${cell.row + 1} ${info.name}${cell.star ? ' ster' : ''}`,
        onclick: (e: Event) => {
          const crossed = [...s.crossed];
          // Weghalen mag altijd (fout herstellen); zetten alleen aansluitend of in kolom H.
          if (!crossed[cell.index] && !canCross(layout, s, cell)) {
            const btn = e.currentTarget as HTMLElement;
            btn.classList.remove('shake');
            void btn.offsetWidth; // animatie opnieuw starten
            btn.classList.add('shake');
            toast(`Kruis aansluitend op een ander kruisje, of in kolom ${layout.columnLabels[layout.startColumn] ?? ''}`);
            return;
          }
          crossed[cell.index] = !crossed[cell.index];
          save({ ...s, crossed });
        },
      },
      cell.star ? h('span', { class: 'kok-star', innerHTML: STAR_SVG }) : null,
    );
  });
  sheet.append(...cellButtons);

  const toggleColumn = (col: number): void => {
    const columnTaken = [...s.columnTaken];
    columnTaken[col] = !columnTaken[col];
    save({ ...s, columnTaken });
  };
  const firstPoints = layout.columnPoints.map(([first], col) =>
    h(
      'button',
      {
        type: 'button',
        class: `kok-points first${col === layout.startColumn ? ' start' : ''}`,
        onclick: () => toggleColumn(col),
        title: 'Tik als een ander deze kolom eerder vol had',
      },
      first,
    ),
  );
  const laterPoints = layout.columnPoints.map(([, later], col) =>
    h(
      'button',
      { type: 'button', class: `kok-points later${col === layout.startColumn ? ' start' : ''}`, onclick: () => toggleColumn(col) },
      later,
    ),
  );
  sheet.append(...firstPoints, ...laterPoints);

  /* --- Zijpaneel: kleurbonus en score (zoals op het papieren blad) --- */
  const endHint = h('div', { class: 'kok-end', role: 'status' });

  const toggleColor = (c: ColorKey): void => save({ ...s, colorTaken: { ...s.colorTaken, [c]: !s.colorTaken[c] } });
  const colorRows = COLOR_ORDER.map((c) => {
    const count = h('span', { class: 'kok-count', title: `${colors[c].name}: afgekruist` });
    const tile = (value: number, kind: string): HTMLButtonElement =>
      h(
        'button',
        {
          type: 'button',
          class: `kok-tile ${kind}`,
          style: `--fill:${colors[c].fill}`,
          'aria-label': `${colors[c].name} bonus ${value}`,
          onclick: () => toggleColor(c),
        },
        value,
      );
    const first = tile(layout.colorBonus[0], 'first');
    const later = tile(layout.colorBonus[1], 'later');
    const row = h('div', { class: 'kok-color' }, count, first, later);
    return { c, row, count, first, later };
  });

  const scoreRow = (label: Node | string, sign: string, extra = ''): { row: HTMLElement; value: HTMLElement } => {
    const value = h('span', { class: 'kok-box' });
    const row = h('div', { class: `kok-score-row ${extra}` }, h('span', { class: 'kok-label' }, label), h('span', { class: `kok-sign ${extra}` }, sign), value);
    return { row, value };
  };
  const bonusRow = scoreRow('Bonus', '=', 'bonus');
  const columnsRow = scoreRow('A–O', '+', 'plus');
  const jokersRow = scoreRow(h('span', null, h('span', { class: 'kok-icon-joker' }, '!'), ' (+1)'), '+', 'plus');
  const starsRow = scoreRow(h('span', null, h('span', { class: 'kok-icon-star', innerHTML: STAR_SVG }), ' (−2)'), '−', 'minus');
  const totalRow = scoreRow('Totaal', '=', 'total');

  const colorsBox = h('div', { class: 'kok-colors' }, colorRows.map((r) => r.row));
  const scoresBox = h('div', { class: 'kok-scores' }, bonusRow.row, columnsRow.row, jokersRow.row, starsRow.row, h('hr'), totalRow.row);
  const help = h('p', { class: 'kok-help' }, 'Had een ander een kolom of kleur eerder vol? Tik op de punten.');

  const jokerButtons = Array.from({ length: layout.jokers }, (_, i) =>
    h(
      'button',
      {
        type: 'button',
        class: 'kok-joker',
        'aria-label': `Joker ${i + 1}`,
        onclick: () => save({ ...s, jokersUsed: i < s.jokersUsed ? i : i + 1 }),
      },
      '!',
    ),
  );
  const jokerStrip = h('div', { class: 'kok-joker-strip' }, h('span', { class: 'kok-joker-label' }, 'Joker'), jokerButtons);

  /* --- Alles bijwerken na elke tik --- */
  function refresh(): void {
    const result = score(layout, s);
    const progress = colorProgress(layout, s);

    cells.forEach((cell, i) => {
      const crossed = Boolean(s.crossed[cell.index]);
      cellButtons[i]?.classList.toggle('crossed', crossed);
      cellButtons[i]?.classList.toggle('blocked', !crossed && !canCross(layout, s, cell));
    });

    layout.columnPoints.forEach((_, col) => {
      const complete = isColumnComplete(layout, s, col);
      const taken = Boolean(s.columnTaken[col]);
      headers[col]?.classList.toggle('complete', complete);
      setPointState(firstPoints[col], laterPoints[col], complete, taken);
    });

    for (const r of colorRows) {
      const { done, total } = progress[r.c];
      r.count.textContent = `${done}/${total}`;
      const complete = result.completeColors.includes(r.c);
      r.row.classList.toggle('complete', complete);
      setPointState(r.first, r.later, complete, s.colorTaken[r.c]);
    }

    jokerButtons.forEach((btn, i) => btn.classList.toggle('used', i < s.jokersUsed));

    bonusRow.value.textContent = String(result.colors);
    columnsRow.value.textContent = String(result.columns);
    jokersRow.value.textContent = String(result.jokers);
    starsRow.value.textContent = String(Math.abs(result.stars));
    totalRow.value.textContent = result.total < 0 ? `−${Math.abs(result.total)}` : String(result.total);

    const full = result.completeColors.length;
    endHint.hidden = full < 2;
    endHint.textContent = `🏁 ${full} kleuren vol: het spel eindigt na deze beurt.`;
  }

  refresh();

  return h(
    'div',
    null,
    h(
      'div',
      { class: 'topbar' },
      h('a', { class: 'btn btn-ghost', href: '../../' }, '‹'),
      h('h1', null, `Keer op Keer · ${layout.name}`, s.player ? h('span', { class: 'muted' }, ` · ${s.player}`) : null),
    ),
    endHint,
    h(
      'div',
      { class: 'kok-board' },
      // Plaatsing per schermbreedte regelt de CSS (grid-template-areas).
      h('div', { class: 'kok-sheet-wrap' }, sheet),
      colorsBox,
      scoresBox,
      jokerStrip,
      help,
    ),
    h(
      'div',
      { class: 'actions row stretch' },
      h('button', { class: 'btn-danger', onclick: () => clearGame() }, 'Wissen'),
      h('button', { class: 'btn-primary', onclick: () => finishGame(s, layout) }, 'Afronden'),
    ),
  );
}

/** Eerste-punten omcirkeld als jij hem vol hebt; doorgestreept als een ander je voor was. */
function setPointState(first: HTMLElement | undefined, later: HTMLElement | undefined, complete: boolean, taken: boolean): void {
  first?.classList.toggle('taken', taken);
  first?.classList.toggle('won', complete && !taken);
  later?.classList.toggle('won', complete && taken);
}

function finishGame(s: KokState, layout: Layout): void {
  const total = score(layout, s).total;
  if (!confirm(`Blad afronden met ${total} punten en opslaan bij "Gespeeld"?`)) return;
  const name = s.player || 'Ik';
  addHistory({ gameId: GAME_ID, title: layout.name, players: [{ name, score: total }], winners: [name] });
  store.clear();
  state = null;
  render();
  toast(`${total} punten opgeslagen`);
}

function clearGame(): void {
  if (!confirm('Blad wissen zonder op te slaan?')) return;
  store.clear();
  state = null;
  render();
}

render();
