import type { Rules } from '@shared/rules';

/** Spiekbriefje Three Sisters, in eigen woorden (Nederlands). */
export const TS_RULES: Rules = {
  title: 'Three Sisters',
  intro:
    'Je kweekt mais, bonen en pompoenen (de "drie zussen"), plus vaste planten, fruit en bijen. Na 8 rondes wint wie de meeste punten heeft.',
  sections: [
    {
      heading: 'Klaarzetten',
      list: [
        'Spelbord in het midden, rondemarker op ronde 1, boerin Edith op het veld met de gouden punaise.',
        'Dobbelstenen: 2 spelers = 4, 3 spelers = 5, 4 spelers = 6. Solo = 4.',
        'Iedereen begint met 1 compost en 0 goederen.',
      ],
    },
    {
      heading: 'Een ronde',
      list: [
        '1. Plannen: de startspeler gooit alle stenen en legt ze per waarde op de draaischijf, van laag naar hoog vanaf Edith. Edith schuift door tot na de hoogste groep.',
        '2. Tuinieren: om de beurt neemt iedereen één steen en doet twee dingen: een tuinactie in de zone van het getal, en de actie van het veld waar de steen lag.',
        'Daarna gebruikt iedereen tegelijk de laagste overgebleven steen (weer tuin + veld).',
        '3. Gebeurtenis van de ronde (schuur, regen of markt). Daarna schuift de startspeler door.',
      ],
    },
    {
      heading: 'Tuinacties (zone = getal op de steen)',
      list: [
        'Planten: tot 2 gewassen in die zone planten (onderste vakje). Met de zaaier tot 3.',
        'Water: elk geplant gewas in die zone groeit één vakje.',
        'Een boon mag pas als de mais ernaast minstens 2 hoog is.',
        'Bovenste rondje gevuld = geoogst. Mais 3 pt, boon 1 pt, pompoen geeft meteen goederen.',
        'Oogst je twee pompoenen naast elkaar, dan krijg je de vaste plant die ertussen staat.',
        'Compost: besteed er 1 om de steen 1 hoger/lager te maken (6 en 1 lopen rond). Iris doet hetzelfde.',
      ],
    },
    {
      heading: 'Velden op de draaischijf',
      list: [
        'Planten of water: nog een tuinactie in dezelfde zone.',
        'Schuur: volgend vakje van één schuuritem.',
        '1 compost en 4 goederen.',
        'Bijen of fruit: volgend vakje van de bijenstal óf van één fruitrij.',
        'Markt: kijk hoeveel goederen je hebt en neem de acties van die rij.',
      ],
    },
    {
      heading: 'Markt',
      list: [
        '0+: 1 compost · 4+: 1 vaste plant + 1 compost · 20+: 1 vaste plant + 1 fruit',
        '35+: 2 vaste planten + 1 compost · 50+: 2 vaste planten + 1 fruit · 70+: 2 vaste planten + 1 bonusactie',
      ],
    },
    {
      heading: 'Goederen en sterren',
      list: [
        'Goederen vul je van links naar rechts. Elke ster (elke 5) is een bonusactie: volgend vakje in vaste planten, bijenstal, fruit of schuur (niet in de tuin).',
      ],
    },
    {
      heading: 'Vaste planten, bijen, fruit, schuur',
      list: [
        'Alles vul je op volgorde: vaste planten en bijen van onder naar boven, fruit en schuur van links naar rechts.',
        'Bijenstal: eerst de kast vol, daarna kies je per actie was, honing of splitsen.',
        'Perzik oogsten = water geven in een zone naar keuze. Framboos = +3 goederen.',
        'Schuuritems geven een doorlopende bonus zodra het rondje gevuld is.',
      ],
    },
    {
      heading: 'Einde en punten',
      list: [
        'Na 8 rondes tel je: tuin (mais 3, boon 1), volle vaste planten, bijenstal (was en honing), fruit (appel 3, braam 2, frambozen 1/2/3) en schuur.',
        'Gelijk? Dan wint wie de meeste tuinpunten heeft.',
      ],
    },
    {
      heading: 'In deze app',
      list: [
        'Tik een ongeplant gewas aan om het te planten. Water geven gaat per zone: tik op het zonenummer of op een geplant gewas.',
        'Tik een vaste plant, fruitrij, bijenkolom of schuuritem aan voor het volgende vakje.',
        'Goederen, compost, sterren en extra acties rekent de app zelf uit. Extra acties komen in het journaal; tik ✓ als je ze gedaan hebt.',
        'Knoppen onder het blad: rondel (+1 compost +4 goederen), markt en regen.',
      ],
    },
  ],
};
