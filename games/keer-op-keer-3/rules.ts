import type { Rules } from '@shared/rules';

/** Spiekbriefje Keer op Keer 3, in eigen woorden. */
export const KOK3_RULES: Rules = {
  title: 'Keer op Keer 3',
  intro:
    'Geen punten deze keer: iedereen begint met 10 X-chips. Elke ✕-bonus die je haalt, kost je een chip. Wie het eerst al zijn chips kwijt is, wint.',
  sections: [
    {
      heading: 'Voorbereiding',
      list: [
        'Iedereen krijgt 10 X-chips van één kleur en legt ze op een rij.',
        'Gooi één keer met alle stenen en kies je startcombinatie (kleur + getal, geen joker). Die noteer je bovenaan je pas-balk.',
      ],
    },
    {
      heading: 'Een worp',
      list: [
        'De speler aan de beurt gooit 3 kleurstenen en 3 cijferstenen en kiest één kleur + één cijfer.',
        'Daarna kiezen de anderen uit de overige 4 stenen (of passen).',
        'De eerste 3 worpen mag iedereen uit alle stenen kiezen.',
      ],
    },
    {
      heading: 'Afkruisen',
      list: [
        'Je eerste kruisjes komen in startkolom H.',
        'Kruis precies het gegooide aantal aan, in één aaneengesloten blok van de gekozen kleur.',
        'Het blok moet recht (niet schuin) grenzen aan een eerder kruisje of in kolom H liggen.',
        'Nooit meer dan 5 per beurt; niet verdelen over twee blokken.',
      ],
    },
    {
      heading: 'Jokers',
      list: [
        '? op een cijfersteen = kies 1–5. Zwart ✕ op een kleursteen = kies een kleur.',
        'Elke joker kost 1 zwart ! op je joker-balk. Je begint met 2; grijze ! speel je vrij met !-bonussen.',
      ],
    },
    {
      heading: 'Passen',
      list: [
        'Pas je, dan vergelijk je de worp met je startcombinatie: per overeenkomst kruis je een vakje op de pas-balk aan, van boven naar beneden.',
        'Geen overeenkomst? Dan toch 1 vakje.',
        'Een donker vakje geeft meteen de bonus ernaast.',
      ],
    },
    {
      heading: 'Bonussen',
      list: [
        'Volle kolom: de bonus eronder. De roze bonus krijgt alleen wie het eerst is; de witte kan iedereen nog halen.',
        'Volle rij (P–V): de ✕ ernaast.',
        'Volle kleur: roze ✕ (eerste) en witte ✕.',
        'Ruitjes: elk ruitje dat je aankruist, streep je ook af in het ruitjesvak. Een volle rij van 5 geeft de bonus ernaast.',
        'Kruispunten I/II/III: zijn de 4 vakjes rond een punt allemaal afgekruist, dan streep je het volgende punt met dat cijfer af. Volle rij of kolom van punten = bonus.',
      ],
    },
    {
      heading: 'Wat betekenen de symbolen?',
      list: [
        '✕ — draai je meest linkse X-chip om. Staat er een bonus op, geef hem aan een andere speler; anders gaat hij uit het spel.',
        '! — speel een grijze joker vrij.',
        '◇ — kruis het volgende vakje van je pas-balk aan.',
        'Bom — kruis tot 4 vakjes in een 2×2 vlak aan, waar je wilt, elke kleur.',
        'Kleurblok — kruis een heel blok van één kleur aan (aansluitend).',
        'Pijl — kruis tot 3 vakjes in één rij aan, elk aansluitend op een kruisje.',
        'Een cadeau-chip van een ander mag je op elk moment inzetten.',
      ],
    },
    {
      heading: 'Einde',
      list: [
        'Het spel eindigt na de worp waarin iemand zijn laatste X-chip kwijtraakt.',
        'Gelijk? Dan wint wie de meeste vakjes heeft aangekruist, daarna de verste pas-balk, daarna de meeste volle kolommen.',
      ],
    },
    {
      heading: 'In deze app',
      list: [
        'Tik vakjes aan om ze te kruisen; de app bewaakt de aansluitregel en ziet zelf welke bonussen je haalt.',
        'Was een ander eerder met een roze bonus? Tik op die bonus om hem door te strepen.',
        'De X-chips, ruitjes, kruispunten en vrijgespeelde jokers worden automatisch bijgehouden.',
      ],
    },
  ],
};
