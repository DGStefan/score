# Scores

Webapp voor telefoon en tablet om scores van spelletjes bij te houden.
TypeScript + Vite, geen framework en geen backend: alles wordt in `localStorage` opgeslagen.

## Aan de slag

Vereist Node.js 20.19+ of 22.12+.

```bash
npm install
npm run dev        # ontwikkelserver, ook bereikbaar op je telefoon via het getoonde Network-adres
npm run build      # typecheck + productiebuild naar dist/
npm run preview    # de build lokaal bekijken
npm run typecheck  # alleen TypeScript controleren
```

Uitrollen: zet de inhoud van `dist/` op een willekeurige webserver (eigen hosting, GitHub Pages, Netlify).
Paden zijn relatief, dus een submap zoals `example.com/scores/` werkt ook.
Voor "installeren op beginscherm" en offline gebruik is https nodig.

## Structuur

```
index.html               Portal: spellen kiezen + geschiedenis
src/portal/main.ts
src/shared/              Gedeelde code voor alle pagina's
  dom.ts                 h()-helper om elementen te bouwen, toast, turfstreepjes
  storage.ts             localStorage-laag (sleutels beginnen met "scores:")
  session.ts             Lopende stand per spel (met versienummer)
  history.ts             Afgeronde potjes + winnaar bepalen
  players.ts             Recent gebruikte spelernamen
  games.ts               Lijst van spellen (voedt het menu van de portal)
  page.ts                Start van elke pagina: CSS, service worker, scherm aanhouden
  style.css
games/<id>/              Eén map per spel, elk een eigen pagina
  index.html
  main.ts
public/                  Ongewijzigd meegekopieerd: manifest, icons, service worker
```

## Opgeslagen data

| Sleutel                           | Inhoud                                    |
| --------------------------------- | ----------------------------------------- |
| `scores:spel:<id>:actief`         | Lopende stand van een spel                |
| `scores:spel:<id>:instellingen`   | Laatst gebruikte instellingen van een spel |
| `scores:geschiedenis`             | Afgeronde potjes (max. 200)               |
| `scores:spelers:recent`           | Recent gebruikte namen                    |

Pas je de opbouw van de stand van een spel aan, verhoog dan `VERSION` in dat spel.
Een oude stand wordt dan genegeerd in plaats van dat het spel crasht.

## Nieuw spel toevoegen

1. Kopieer `games/teller/` naar `games/<id>/` (de map wordt automatisch opgepikt door `vite.config.ts`).
2. Pas `GAME_ID`, de interface van de stand en de weergave aan in `main.ts`.
3. Zet het spel in `src/shared/games.ts` met `status: 'beschikbaar'`.
4. Bij afronden: `addHistory({ gameId, title, players, winners })`, dan verschijnt het bij "Gespeeld".

## Keer op Keer: bladen aanpassen

De bladen staan in `games/keer-op-keer/layouts.ts`. Een blad is alleen data:

- `grid`: één regel per rij, één letter per vakje: `g` groen, `y` geel, `b` blauw, `r` roze, `o` oranje.
  Een hoofdletter (`G`, `Y`, …) is een vakje met een ster.
- `columnPoints`: punten per kolom als `[eerste, later]`.
- `colorBonus`, `jokers`, `starPenalty`, `startColumn`: spreken voor zich.
- `colors` (optioneel): eigen kleuren voor dit blad.

Een nieuw blad toevoegen: kopieer het object in `LAYOUTS`, geef het een eigen `id` en `name`.
Het verschijnt dan vanzelf op het keuzescherm. Fouten (rij te kort, onbekende letter) worden daar getoond.

## Uitrollen met Coolify + Cloudflare Tunnel

De repo bevat een `Dockerfile` (Node bouwt, nginx serveert) en `nginx.conf` (caching goed voor de service worker).

1. **Coolify** → *Projects* → *New resource* → *Private repository (with GitHub App)* → kies deze repo, branch `main`.
2. **Build pack:** `Dockerfile`. Poort: `80`.
3. **Domein:** `http://scores.jouwdomein.nl` — let op: **http**, niet https. Cloudflare doet de https;
   met https in Coolify probeert Traefik zelf een certificaat te halen en krijg je redirect-loops.
4. **Cloudflare Zero Trust** → *Networks* → *Tunnels* → je bestaande tunnel → *Public hostname* toevoegen:
   `scores.jouwdomein.nl` → service `http://localhost:80` (of het IP van de Pi als cloudflared ergens anders draait).
5. **Automatisch deployen bij een push:** zet *Auto deploy* aan. GitHub moet daarvoor de Coolify-webhook kunnen bereiken,
   dus Coolify zelf moet ook via de tunnel bereikbaar zijn (bv. `coolify.jouwdomein.nl` → `http://localhost:8000`).
   Zet je Cloudflare Access voor het dashboard, maak dan een *Bypass*-regel voor het pad `/webhooks/*`.

## Ideeën / volgende stappen

- Spellen: darts (501/301), Yahtzee
- Export/import van alle data als JSON (back-up of naar ander apparaat)
- Statistieken per speler in de portal
