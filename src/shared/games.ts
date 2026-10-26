/** Overzicht van alle spellen. De portal bouwt hier zijn menu uit op. */
export interface GameInfo {
  /** Gelijk aan de mapnaam in /games */
  id: string;
  name: string;
  description: string;
  icon: string;
  status: 'beschikbaar' | 'binnenkort';
}

export const GAMES: readonly GameInfo[] = [
  {
    id: 'teller',
    name: 'Scoreblad',
    description: 'Punten per speler optellen of aftrekken, met eigen titel. Turven kan ook.',
    icon: '✏️',
    status: 'beschikbaar',
  },
  {
    id: 'rondes',
    name: 'Rondetabel',
    description: 'Score per ronde invullen, totalen worden opgeteld. Voor kaartspellen e.d.',
    icon: '🃏',
    status: 'binnenkort',
  },
  {
    id: 'darts',
    name: 'Darts',
    description: '501 / 301 aftellen met bust-controle.',
    icon: '🎯',
    status: 'binnenkort',
  },
  {
    id: 'sushi-go',
    name: 'Sushi Go!',
    description: 'Kaarten tellen per ronde; maki, pudding en sets worden uitgerekend.',
    icon: '🍣',
    status: 'beschikbaar',
  },
  {
    id: 'yahtzee',
    name: 'Yahtzee',
    description: 'Compleet scoreblad met automatische bonus en totalen.',
    icon: '🎲',
    status: 'binnenkort',
  },
  {
    id: 'keer-op-keer',
    name: 'Keer op Keer',
    description: 'Scoreblad voor op de tablet: zelf afkruisen, de score rekent mee.',
    icon: '🟩',
    status: 'beschikbaar',
  },
];

export function gameById(id: string): GameInfo | undefined {
  return GAMES.find((g) => g.id === id);
}
