import type { Rules } from '@shared/rules';

/** Spiekbriefje Qwixx, in eigen woorden. */
export const QWIXX_RULES: Rules = {
  title: 'Qwixx',
  intro:
    'Snel dobbelspel voor 2–5 spelers. Iedereen heeft een eigen blad met vier gekleurde rijen en kruist getallen af. Hoe meer kruisjes in een rij, hoe meer punten.',
  sections: [
    {
      heading: 'Wat heb je nodig',
      list: ['6 dobbelstenen: 2 witte en 1 rode, gele, groene en blauwe', 'Per speler een scoreblad (deze app)'],
    },
    {
      heading: 'Een beurt',
      text: ['Om de beurt is iemand de actieve speler en gooit alle zes de stenen.'],
      list: [
        'Stap 1 – iedereen: tel de twee witte stenen bij elkaar op. Elke speler mag dat getal in één rij naar keuze afkruisen (hoeft niet).',
        'Stap 2 – alleen de actieve speler: combineer één witte steen met één gekleurde steen en kruis die som af in de rij van díe kleur (hoeft ook niet).',
        'Heeft de actieve speler in stap 1 én 2 niets afgekruist, dan krijgt hij een misworp (−5).',
        'Daarna is de volgende speler aan de beurt.',
      ],
    },
    {
      heading: 'Afkruisen',
      list: [
        'Altijd van links naar rechts. Je mag getallen overslaan, maar overgeslagen vakjes kun je later niet meer kruisen.',
        'Rood en geel lopen van 2 naar 12, groen en blauw van 12 naar 2.',
      ],
    },
    {
      heading: 'Een rij afsluiten',
      list: [
        'Het laatste getal van een rij (12 bij rood/geel, 2 bij groen/blauw) mag je pas kruisen als je al minstens 5 kruisjes in die rij hebt.',
        'Dan kruis je ook het slotje: dat telt als extra kruisje. De rij is nu voor iedereen dicht en de dobbelsteen van die kleur gaat uit het spel.',
        'Sluit iemand anders een rij af, tik dan op het slotje van die rij om hem bij jou ook dicht te zetten.',
      ],
    },
    {
      heading: 'Einde van het spel',
      list: ['Zodra iemand 4 misworpen heeft, of', 'zodra er 2 rijen zijn afgesloten (dat mag ook in dezelfde beurt gebeuren).'],
    },
    {
      heading: 'Punten',
      text: ['Per rij levert het aantal kruisjes punten op; de app rekent dit voor je uit:'],
      list: [
        '1 → 1 · 2 → 3 · 3 → 6 · 4 → 10 · 5 → 15 · 6 → 21',
        '7 → 28 · 8 → 36 · 9 → 45 · 10 → 55 · 11 → 66 · 12 → 78',
        'Elke misworp kost 5 punten. Hoogste totaal wint.',
      ],
    },
  ],
};
