import { defineConfig } from 'vite';
import { existsSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';

const root = fileURLToPath(new URL('.', import.meta.url));

/**
 * Elke map in /games met een index.html wordt automatisch een eigen pagina.
 * Een nieuw spel toevoegen = map aanmaken + registreren in src/shared/games.ts.
 */
function pages(): Record<string, string> {
  const input: Record<string, string> = { portal: resolve(root, 'index.html') };
  const gamesDir = resolve(root, 'games');
  for (const entry of readdirSync(gamesDir, { withFileTypes: true })) {
    const html = resolve(gamesDir, entry.name, 'index.html');
    if (entry.isDirectory() && existsSync(html)) input[entry.name] = html;
  }
  return input;
}

export default defineConfig({
  // Relatieve paden: de build werkt in elke (sub)map op een server.
  base: './',
  resolve: {
    alias: { '@shared': resolve(root, 'src/shared') },
  },
  build: {
    rollupOptions: { input: pages() },
  },
});
