/** Minimale helper om DOM-elementen te bouwen zonder framework. */
type Child = Node | string | number | null | undefined | false;
type Props = Record<string, unknown>;

export function h<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  props: Props | null = null,
  ...children: (Child | Child[])[]
): HTMLElementTagNameMap[K] {
  const el = document.createElement(tag);
  if (props) {
    for (const [key, value] of Object.entries(props)) {
      if (value === null || value === undefined || value === false) continue;
      if (key.startsWith('on') && typeof value === 'function') {
        el.addEventListener(key.slice(2).toLowerCase(), value as EventListener);
      } else if (key === 'class') {
        el.className = String(value);
      } else if (key in el && key !== 'style' && key !== 'list') {
        (el as unknown as Record<string, unknown>)[key] = value;
      } else {
        el.setAttribute(key, value === true ? '' : String(value));
      }
    }
  }
  for (const child of children.flat()) {
    if (child === null || child === undefined || child === false) continue;
    el.append(child instanceof Node ? child : String(child));
  }
  return el;
}

export function mount(selector: string): HTMLElement {
  const el = document.querySelector<HTMLElement>(selector);
  if (!el) throw new Error(`Element ${selector} niet gevonden`);
  return el;
}

/** Korte melding onderin het scherm. */
export function toast(message: string, ms = 2500): void {
  const el = h('div', { class: 'toast', role: 'status' }, message);
  document.body.append(el);
  requestAnimationFrame(() => el.classList.add('show'));
  setTimeout(() => {
    el.classList.remove('show');
    setTimeout(() => el.remove(), 300);
  }, ms);
}

/** Turfstreepjes: groepjes van vijf. */
export function tallyMarks(count: number): HTMLElement {
  const wrap = h('span', { class: 'tally', 'aria-hidden': 'true' });
  const fives = Math.floor(count / 5);
  const rest = count % 5;
  for (let i = 0; i < fives; i++) wrap.append(tallyGroup(4, true));
  if (rest > 0) wrap.append(tallyGroup(rest, false));
  return wrap;
}

function tallyGroup(bars: number, crossed: boolean): HTMLElement {
  const group = h('span', { class: crossed ? 'tally-group crossed' : 'tally-group' });
  for (let i = 0; i < bars; i++) group.append(h('i'));
  return group;
}
