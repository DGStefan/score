import { readJSON, writeJSON } from './storage';

/** 'auto' volgt het apparaat; licht/donker forceert het thema. */
export type Theme = 'auto' | 'licht' | 'donker';

const KEY = 'thema';

export function getTheme(): Theme {
  return readJSON<Theme>(KEY, 'auto');
}

export function setTheme(theme: Theme): void {
  writeJSON(KEY, theme);
  applyTheme(theme);
}

/** Zet data-theme op <html>. Een inline script in elke index.html doet dit al vóór het tekenen. */
export function applyTheme(theme: Theme = getTheme()): void {
  const root = document.documentElement;
  if (theme === 'licht') root.dataset.theme = 'light';
  else if (theme === 'donker') root.dataset.theme = 'dark';
  else delete root.dataset.theme;
}
