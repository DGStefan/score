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
    description: 'Vrij tellen of per ronde, met eigen titel, doelscore en turven.',
    icon: '✏️',
    status: 'beschikbaar',
  },
  {
    id: 'sushi-go',
    name: 'Sushi Go!',
    description: 'Kaarten tellen per ronde; maki, pudding en sets worden uitgerekend.',
    icon: '🍣',
    status: 'beschikbaar',
  },
  {
    id: 'qwixx',
    name: 'Qwixx',
    description: 'Eigen blad per speler: kruisen, rijen afsluiten, punten rekenen. Met spelregels en dobbelstenen.',
    icon: '🎲',
    status: 'beschikbaar',
  },
  {
    id: 'keer-op-keer-2',
    name: 'Keer op Keer 2',
    description: 'Met speciale dobbelsteen, bommen, harten en rijen P–V. Alles wordt meegeteld.',
    icon: '💣',
    status: 'beschikbaar',
  },
  {
    id: 'ganz-schon-clever',
    name: 'Clever',
    description: 'Neon-blad per speler: bonussen, vossen en kettingreacties worden voor je bijgehouden.',
    icon: '🦊',
    status: 'beschikbaar',
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
