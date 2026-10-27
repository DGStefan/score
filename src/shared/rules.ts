import { h } from './dom';

/**
 * Spelregels als spiekbriefje: een ?-knop die een paneel opent.
 * De inhoud is per spel gewone data, in eigen woorden geschreven.
 */

export interface RuleSection {
  heading: string;
  text?: string[];
  list?: string[];
}

export interface Rules {
  title: string;
  intro?: string;
  sections: RuleSection[];
}

export function rulesButton(rules: Rules): HTMLElement {
  const dialog = h(
    'dialog',
    { class: 'rules-dialog', 'aria-label': `Spelregels ${rules.title}` },
    h(
      'div',
      { class: 'rules-head' },
      h('h2', null, `Spelregels · ${rules.title}`),
      h('button', { type: 'button', class: 'btn-ghost', 'aria-label': 'Sluiten', onclick: () => dialog.close() }, '✕'),
    ),
    h(
      'div',
      { class: 'rules-body' },
      rules.intro ? h('p', { class: 'rules-intro' }, rules.intro) : null,
      rules.sections.map((s) =>
        h(
          'section',
          null,
          h('h3', null, s.heading),
          (s.text ?? []).map((t) => h('p', null, t)),
          s.list ? h('ul', null, s.list.map((li) => h('li', null, li))) : null,
        ),
      ),
    ),
  );
  // Klik op de achtergrond sluit het paneel
  dialog.addEventListener('click', (e) => {
    if (e.target === dialog) dialog.close();
  });

  const button = h(
    'button',
    {
      type: 'button',
      class: 'rules-button',
      'aria-label': 'Spelregels',
      title: 'Spelregels',
      onclick: () => dialog.showModal(),
    },
    '?',
  );
  return h('span', { class: 'rules' }, button, dialog);
}
