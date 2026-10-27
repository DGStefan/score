import { h } from './dom';
import { readJSON, writeJSON } from './storage';

/**
 * Inklapbaar paneel met digitale dobbelstenen. Standaard dicht; of het open staat
 * wordt per spel onthouden. De laatste worp blijft staan zolang de pagina open is.
 */

export interface DieFace {
  /** Wat er op de steen staat: stippen (1–6), een tekst/getal, of een kleur. */
  pips?: number;
  label?: string;
  /** Vulkleur van een kleurvlak (kleurdobbelsteen). */
  color?: string;
  joker?: boolean;
}

export interface DieSpec {
  id: string;
  name: string;
  /** Kleur van de steen en van de stippen/tekst. */
  bg: string;
  ink: string;
  faces: DieFace[];
  /** Uit het spel (bv. afgesloten rij bij Qwixx): grijs en telt niet mee. */
  out?: boolean;
}

export type Roll = Record<string, DieFace>;

interface DicePanelOptions {
  /** Unieke sleutel per spel, voor open/dicht en de laatste worp. */
  id: string;
  dice: DieSpec[];
  /** Korte uitleg onder de knop. */
  hint?: string;
  /** Uitleg bij de worp, bv. sommen bij Qwixx. */
  describe?: (roll: Roll) => Node | null;
}

/** Laatste worp per paneel, in het geheugen. */
const lastRolls = new Map<string, Roll>();

/** Standaard dobbelsteen 1–6 met stippen. */
export function pipFaces(): DieFace[] {
  return [1, 2, 3, 4, 5, 6].map((pips) => ({ pips }));
}

const PIP_LAYOUT: Record<number, number[]> = {
  1: [4],
  2: [0, 8],
  3: [0, 4, 8],
  4: [0, 2, 6, 8],
  5: [0, 2, 4, 6, 8],
  6: [0, 2, 3, 5, 6, 8],
};

function pick<T>(items: T[]): T {
  return items[Math.floor(Math.random() * items.length)] as T;
}

function renderFace(el: HTMLElement, spec: DieSpec, face: DieFace | undefined): void {
  el.replaceChildren();
  el.className = 'die';
  if (spec.out) el.classList.add('out');
  el.style.setProperty('--die', spec.bg);
  el.style.setProperty('--ink', spec.ink);
  el.style.removeProperty('--face');
  if (!face) {
    el.classList.add('blank');
    el.setAttribute('aria-label', `${spec.name}: nog niet gegooid`);
    return;
  }
  if (face.pips) {
    el.classList.add('pips');
    for (let i = 0; i < 9; i++) el.append(h('i', { class: PIP_LAYOUT[face.pips]?.includes(i) ? 'on' : '' }));
    el.setAttribute('aria-label', `${spec.name}: ${face.pips}`);
  } else if (face.color) {
    el.classList.add('color');
    el.style.setProperty('--face', face.color);
    el.append(h('span', null, face.label ?? ''));
    el.setAttribute('aria-label', `${spec.name}: ${face.label ?? 'kleur'}`);
  } else {
    el.classList.add('label');
    if (face.joker) el.classList.add('joker');
    el.append(h('span', null, face.label ?? '?'));
    el.setAttribute('aria-label', `${spec.name}: ${face.joker ? 'joker' : (face.label ?? '')}`);
  }
}

export function dicePanel(opts: DicePanelOptions): HTMLElement {
  const openKey = `dobbelstenen:${opts.id}:open`;
  let roll = lastRolls.get(opts.id) ?? null;

  const faces = opts.dice.map((spec) => {
    const el = h('span', { class: 'die' });
    renderFace(el, spec, roll?.[spec.id]);
    return el;
  });
  const description = h('div', { class: 'dice-describe' });
  const button = h('button', { type: 'button', class: 'btn-primary btn-big' }, roll ? 'Opnieuw gooien' : 'Gooien');

  const showDescription = (): void => {
    description.replaceChildren();
    const node = roll && opts.describe ? opts.describe(roll) : null;
    if (node) description.append(node);
  };
  showDescription();

  const randomRoll = (): Roll => Object.fromEntries(opts.dice.map((d) => [d.id, pick(d.faces)]));

  button.addEventListener('click', () => {
    const final = randomRoll();
    const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
    let frames = reduce ? 7 : 0;
    button.disabled = true;
    description.replaceChildren();
    const tick = (): void => {
      frames++;
      const shown = frames < 7 ? randomRoll() : final;
      opts.dice.forEach((spec, i) => {
        const el = faces[i];
        if (!el) return;
        renderFace(el, spec, spec.out ? undefined : shown[spec.id]);
        el.classList.toggle('rolling', frames < 7 && !spec.out);
      });
      if (frames < 7) {
        setTimeout(tick, 60);
        return;
      }
      roll = final;
      lastRolls.set(opts.id, final);
      button.disabled = false;
      button.textContent = 'Opnieuw gooien';
      showDescription();
    };
    tick();
  });

  const details = h(
    'details',
    { class: 'card dice-panel', open: readJSON<boolean>(openKey, false) },
    h('summary', null, '🎲 Dobbelstenen', h('small', { class: 'muted' }, ' · als je ze niet bij de hand hebt')),
    h(
      'div',
      { class: 'dice-body' },
      h('div', { class: 'dice-row' }, faces),
      button,
      opts.hint ? h('p', { class: 'muted dice-hint' }, opts.hint) : null,
      description,
    ),
  );
  details.addEventListener('toggle', () => writeJSON(openKey, details.open));
  return details;
}
