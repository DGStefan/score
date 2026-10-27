import type { Rules } from '@shared/rules';

/** Spiekbriefje Ganz schön clever, in eigen woorden. */
export const GSC_RULES: Rules = {
  title: 'Ganz schön clever',
  intro:
    'Dobbelspel voor 1–4 spelers. Iedereen vult zijn eigen blad met vijf gekleurde gebieden. Slim kiezen levert bonussen op die weer andere bonussen activeren — daar zit de lol in.',
  sections: [
    {
      heading: 'Wat heb je nodig',
      list: ['6 dobbelstenen: wit, geel, blauw, groen, oranje en paars', 'Per speler een scoreblad (deze app)'],
    },
    {
      heading: 'Aantal rondes',
      list: ['1–2 spelers: 6 rondes', '3 spelers: 5 rondes', '4 spelers: 4 rondes', 'Tik bovenaan op de ronde zodra die begint: rondes 1–4 geven een bonus.'],
    },
    {
      heading: 'Jouw beurt (actieve speler)',
      list: [
        'Gooi alle stenen en kies er één. Gebruik hem in het gebied van die kleur (wit mag in elk gebied).',
        'Leg alle stenen met een LAGERE waarde dan jouw keuze op het zilveren dienblad: die kun je deze beurt niet meer gebruiken.',
        'Gooi de overgebleven stenen opnieuw en kies weer. Dat doe je maximaal 3 keer.',
        'Tip: een hoge steen kiezen kost je vaak veel andere stenen.',
      ],
    },
    {
      heading: 'De andere spelers',
      list: [
        'Na de beurt kiest iedere andere speler één steen van het zilveren dienblad (de lage stenen) en gebruikt die op zijn eigen blad.',
        'Zijn er minder dan 3 stenen op het dienblad gekomen, dan liggen de niet-gekozen stenen er ook bij.',
      ],
    },
    {
      heading: 'De gebieden',
      list: [
        'Geel: kruis een vakje met precies de waarde van de steen. Volle kolom = punten (10/14/16/20).',
        'Blauw: tel blauw + wit op en kruis die som. Hoe meer kruisjes, hoe meer punten (zie bovenaan het gebied).',
        'Groen: van links naar rechts; de steen moet minstens de waarde in het vakje hebben (≥).',
        'Oranje: van links naar rechts de waarde invullen; sommige vakjes tellen ×2 of ×3.',
        'Paars: van links naar rechts; elk getal moet hoger zijn dan het vorige. Na een 6 mag weer alles.',
      ],
    },
    {
      heading: 'Bonussen',
      list: [
        'Een vol rijtje of bepaald vakje geeft een bonus. De app ziet dat en zet hem bovenaan bij "Openstaande bonussen".',
        'Gekleurd kruisje (bijv. blauw ✕): kruis meteen een vakje naar keuze in dat gebied (groen: het volgende vakje).',
        'Gekleurd getal (bijv. oranje 4): vul dat getal meteen in het volgende vakje in.',
        'Herworp: één keer een worp overdoen (niet als je van het dienblad kiest). Telt bij de cirkels bovenaan.',
        '+1: extra steen aan het eind van een beurt, ook als je niet aan de beurt bent. Telt bij de +1-cirkels.',
        'Vos: aan het eind levert elke vos de punten van je laagste gebied op.',
        'Bonussen kunnen elkaar activeren: zo ontstaan mooie kettingreacties.',
      ],
    },
    {
      heading: 'Punten',
      list: [
        'Tel alle vijf de gebieden op.',
        'Plus: aantal vossen × de score van je laagste gebied.',
        'Ongebruikte herworpen en +1’en tellen niet mee. Hoogste totaal wint.',
      ],
    },
  ],
};
