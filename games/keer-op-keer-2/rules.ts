import type { Rules } from '@shared/rules';

/** Spiekbriefje Keer op Keer 2, in eigen woorden. */
export const KOK2_RULES: Rules = {
  title: 'Keer op Keer 2',
  intro:
    'Zoals Keer op Keer, maar met een extra speciale dobbelsteen, rijen P–V, harten en gouden dobbelsteenvakjes. Wie twee kleuren vol heeft, beëindigt het spel.',
  sections: [
    {
      heading: 'Een worp',
      list: [
        'De actieve speler gooit alle 7 stenen: 3 kleuren, 3 cijfers en de speciale dobbelsteen.',
        'Hij kiest één kleur + één cijfer, óf de speciale dobbelsteen (als hij er een omcirkeld heeft).',
        'Daarna kiezen de andere spelers uit de overgebleven stenen. Meerdere spelers mogen hetzelfde kiezen.',
        'Eerste 3 worpen: iedereen mag kiezen uit alle 7 stenen.',
        'Passen mag altijd. Past de actieve speler, dan kiezen de anderen uit alle 7 stenen.',
      ],
    },
    {
      heading: 'Afkruisen',
      list: [
        'Je eerste kruisje komt in startkolom H.',
        'Alle kruisjes van één beurt: precies het gegooide aantal, in één aaneengesloten blok van de gekozen kleur.',
        'Dat blok moet recht (niet schuin) grenzen aan een eerder kruisje of in kolom H liggen.',
        'Nooit meer dan 5 vakjes per beurt; het cijfer niet opsplitsen over losse blokken.',
      ],
    },
    {
      heading: 'Jokers',
      list: [
        'Het ? op een cijfer- of kleursteen is een joker: kies zelf een cijfer (1–5) of kleur.',
        'Elke gebruikte joker kost een !. Op = op. Ongebruikte ! zijn aan het eind 1 punt waard.',
      ],
    },
    {
      heading: 'Speciale dobbelsteen',
      text: [
        'Je hebt er aan het begin één (omcirkeld). Je verdient er meer met de gouden dobbelsteenvakjes, met kolom H vol en met de rijbonus van P en T. Gebruik je er één, dan streep je hem door (tik in de app op het dobbelsteentje). Elke ongebruikte omcirkelde dobbelsteen is aan het eind 2 punten waard.',
      ],
      list: [
        '💣 Bom: kruis tot 4 vakjes binnen een 2×2 vlak, waar je maar wilt (hoeft niet aan te sluiten, kleuren maakt niet uit).',
        '❤️ Hart: omcirkel het volgende hart. Elk vol kolom krijgt de hartwaarde die je op dat moment hebt.',
        '⭐ Sterren: kruis maximaal 2 sterren aan (wel aansluitend).',
        '➖ Drie op een rij: kruis maximaal 3 vakjes in één rij (aansluitend).',
        '▦ Kleurblok: kruis een heel blok van één kleur aan (aansluitend), mag ook groter dan 5.',
      ],
    },
    {
      heading: 'Kolommen, rijen en harten',
      list: [
        'Volle kolom: de eerste krijgt de bovenste punten, latere spelers de onderste. Kolom H geeft ook een speciale dobbelsteen.',
        'Bij elke volle kolom noteer je je huidige hartwaarde (aantal omcirkelde harten). Die krijg je altijd, ook als je niet de eerste bent.',
        'Volle rij (P–V): altijd 5 punten. De eerste krijgt ook de bonus ernaast (dobbelsteen, bom of hart).',
        'Volgorde bij tegelijk vol: eerst de rijbonus, daarna de punten van rijen en kolommen.',
      ],
    },
    {
      heading: 'Einde en punten',
      list: [
        'Het spel eindigt na de worp waarin iemand zijn tweede kleur vol heeft.',
        'Kleuren (5 eerst, 3 later) + kolommen + rijen + harten + ongebruikte ! (1) + ongebruikte dobbelstenen (2) − niet-gekruiste sterren (2).',
        'Gelijkspel: meeste ! over wint.',
      ],
    },
  ],
};
