import type { Rules } from '@shared/rules';

/** Spiekbriefje Trek 12 (Trek-modus), in eigen woorden. */
export const TREK12_RULES: Rules = {
  title: 'Trek 12',
  intro:
    'Iedereen vult zijn eigen berg met getallen. Na 19 worpen deel je je berg op in lijnen en zones; die leveren punten op. Losse rondjes kosten punten.',
  sections: [
    {
      heading: 'Een worp',
      list: [
        'Gooi de rode (1–6) en de gele (0–5) dobbelsteen. Iedereen gebruikt dezelfde worp.',
        'Kies één uitkomst: laagste, hoogste, verschil, som of product.',
        'Elke uitkomst heeft 4 vakjes; zijn ze vol, dan kun je die uitkomst niet meer kiezen.',
        'Schrijf het getal in een leeg rondje. Het eerste getal mag overal, daarna altijd grenzend aan een rondje dat je al gevuld hebt.',
        'Hoger dan 12 (of hoger dan 6 op gevaarlijk terrein met dikke rand)? Dan komt er een doodshoofd in dat rondje.',
      ],
    },
    {
      heading: 'Lijnen en zones',
      list: [
        'Lijn: een pad van aangrenzende rondjes met opeenvolgende, unieke getallen, zoals 4-5-6-7.',
        'Zone: aangrenzende rondjes met allemaal hetzelfde getal, zoals 3-3-3.',
        'Een rondje mag in één lijn én in één zone tegelijk zitten.',
        'Punten: het hoogste getal van de lijn (of het getal van de zone) + 1 per ander rondje. Lijn 4-5-6-7 = 7 + 3 = 10.',
        'Je langste lijn en je grootste zone krijgen een bonus uit de tabel op het blad.',
      ],
    },
    {
      heading: 'Straf en einde',
      list: [
        'Elk doodshoofd kost 3 punten.',
        'Rondjes die in geen enkele lijn of zone zitten, worden ook een doodshoofd.',
        'Expeditie: elke ongebruikte hulpkaart is aan het eind 3 punten waard.',
        'Haal je de topscore van de berg (Dunai: 65), dan heb je de top bereikt.',
      ],
    },
    {
      heading: 'In deze app',
      list: [
        'Kies de rode en gele steen (of laat de app gooien), tik een uitkomst en tik dan een oplichtend rondje.',
        'Na 19 worpen: tik rondjes aan en maak er een lijn of zone van. De app controleert en telt.',
        'Vergist? De ↶-knop zet de laatste stap terug.',
      ],
    },
  ],
};
