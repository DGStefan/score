/** Overzicht van alle spellen. De portal bouwt hier zijn menu uit op. */
export interface GameInfo {
  /** Gelijk aan de mapnaam in /games */
  id: string;
  name: string;
  description: string;
  icon: string;
  /** Soort spel; de portal groepeert hierop. */
  kind: GameKind;
  /** Accentkleur voor de tegel in de portal. */
  color: string;
  status: 'beschikbaar' | 'binnenkort';
}

export type GameKind = 'algemeen' | 'dobbel' | 'kaart';

export const KIND_LABELS: Record<GameKind, string> = {
  dobbel: 'Dobbelspellen',
  kaart: 'Kaartspellen',
  algemeen: 'Algemeen',
};

export const GAMES: readonly GameInfo[] = [
  {
    id: 'teller',
    name: 'Scoreblad',
    description: 'Vrij tellen of per ronde, met eigen titel, doelscore en turven.',
    icon: '✏️',
    kind: 'algemeen',
    color: '#8a7356',
    status: 'beschikbaar',
  },
  {
    id: 'sushi-go',
    name: 'Sushi Go!',
    description: 'Kaarten tellen per ronde; maki, pudding en sets worden uitgerekend.',
    icon: '🍣',
    kind: 'kaart',
    color: '#e2574c',
    status: 'beschikbaar',
  },
  {
    id: 'qwixx',
    name: 'Qwixx',
    description: 'Eigen blad per speler: kruisen, rijen afsluiten, punten rekenen. Met spelregels en dobbelstenen.',
    icon: '🎲',
    kind: 'dobbel',
    color: '#2f8fd6',
    status: 'beschikbaar',
  },
  {
    id: 'keer-op-keer-2',
    name: 'Keer op Keer 2',
    description: 'Met speciale dobbelsteen, bommen, harten en rijen P–V. Alles wordt meegeteld.',
    icon: '💣',
    kind: 'dobbel',
    color: '#e0912b',
    status: 'beschikbaar',
  },
  {
    id: 'keer-op-keer-3',
    name: 'Keer op Keer 3',
    description: 'Paars blad met ruitjes, kruispunten en een pas-balk. Wie het eerst zijn 10 X-chips kwijt is, wint.',
    icon: '✖️',
    kind: 'dobbel',
    color: '#6a48b0',
    status: 'beschikbaar',
  },
  {
    id: 'ganz-schon-clever',
    name: 'Clever',
    description: 'Neon-blad per speler: bonussen, vossen en kettingreacties worden voor je bijgehouden.',
    icon: '🦊',
    kind: 'dobbel',
    color: '#7a4fd0',
    status: 'beschikbaar',
  },
  {
    id: 'trek-12',
    name: 'Trek 12',
    description: 'Vul je berg met getallen, trek lijnen en zones; de app controleert en telt.',
    icon: '🏔️',
    kind: 'dobbel',
    color: '#3fa58f',
    status: 'beschikbaar',
  },
  {
    id: 'keer-op-keer',
    name: 'Keer op Keer',
    description: 'Scoreblad voor op de tablet: zelf afkruisen, de score rekent mee.',
    icon: '🟩',
    kind: 'dobbel',
    color: '#4fa63a',
    status: 'beschikbaar',
  },
];

export function gameById(id: string): GameInfo | undefined {
  return GAMES.find((g) => g.id === id);
}
