# Scores – notities voor Claude

- Lees eerst README.md voor structuur en datamodel.
- Stack: TypeScript (strict) + Vite multi-page, vanilla DOM via `h()` uit `src/shared/dom.ts`. Geen framework toevoegen zonder overleg.
- UI-teksten in het Nederlands, code (namen, types) in het Engels; commentaar mag Nederlands.
- Mobiel eerst: tikvlakken minimaal 44px, testen op telefoonformaat, licht én donker thema.
- Elke spelactie direct opslaan via `sessionStore`; "ongedaan maken" moet altijd kunnen.
- Controleer na wijzigingen met `npm run build` (draait ook de typecheck).
