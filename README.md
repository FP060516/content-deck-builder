## Snel starten (Mac)
Dubbelklik op **start.command** in de map `content-deck-builder`. Dat haalt de nieuwste versie op, installeert alles, werkt de database bij en opent de app. Of in de terminal: `cd content-deck-builder` en dan `./start.command`.

# Content Deck Builder

Lokale tool om content decks te maken: inspiratie uit de Meta Ad Library, met toepassingsteksten per klant.

> Status: **fase 1 (fundament)**. Klantbeheer, briefingscherm, presets. Scraper en AI volgen in fase 2–4.

## Installatie

```bash
npm i
cp .env.example .env
npx prisma migrate dev
npm run dev
```

Open http://localhost:3000.

(Vanaf fase 2 ook: `npx playwright install chromium`.)

## Gebruik (fase 1)
1. **Klanten → Nieuwe klant**: naam, branche, tone of voice, USP's, verboden claims, concurrenten, producten, gat-analyse.
2. **Nieuw deck** bij een klant → het briefingscherm. Kies een preset of vul de secties in: periode, funnel, doel, angle, structuur (steppers), inspiratie en filters.
3. Onder "Periode" zie je live **voor welke datum het deck is** en **in welk zoekvenster van de Ad Library** gezocht wordt (standaard: hetzelfde moment vorig jaar plus 14 dagen aanloop).
4. **Briefing opslaan** of **Opslaan als preset**.

## Tests
```bash
npm test
```

## Fase 2: Scraper
- Menu **Scraper**: zoekterm, land, media en periode invullen, dan **Zoeken**. Je ziet live voortgang, daarna een contactsheet met de gevonden ads.
- Creatives worden meteen gedownload naar `storage/media/…`, omdat Facebook-links na een paar dagen verlopen.
- Dezelfde zoekopdracht binnen 24 uur komt uit de cache, zodat Meta niet onnodig vaak wordt bezocht.
- Je wilt meekijken wat de browser doet? Zet in `.env` `SCRAPER_HEADLESS="false"`.
- Alleen openbare Ad Library-data, zonder login, in een rustig tempo. Media zijn alleen voor intern inspiratiegebruik.
