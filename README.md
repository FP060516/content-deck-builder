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

## Fase 3: Klantprofiel
1. Ga naar **Instellingen** en plak je Anthropic API-sleutel (aan te maken op platform.claude.com). Klik op **Verbinding testen**.
2. Open een klant (of **Nieuwe klant**), vul **Website-URL** en **Pagina-naam in de Ad Library** in.
3. Klik bij **Profiel automatisch invullen** op **Analyseren**. De tool leest de website (tekst + producten) en de eigen ads; Claude stelt branche, positionering, tone of voice, USP's, "niet beloven", concurrenten en een gat-analyse voor.
4. Vink aan wat je wilt overnemen, klik **Overnemen in formulier** en daarna **Wijzigingen opslaan**.
Kosten per analyse staan erbij (meestal enkele centen).

## Fase 4: Genereren
1. Zorg dat de klant een profiel heeft (fase 3) en dat de API-sleutel is ingesteld.
2. Open een deck, vul de briefing in en klik op **Genereer** (rechtsonder).
3. De tool maakt een zoekplan, haalt ads op uit de Ad Library (vorig jaar dezelfde periode), filtert ruis, kiest de beste per contenttype en schrijft per ad een toepassingstekst. Dit duurt 3–10 minuten; de voortgang staat onder **Resultaat**.
4. Onderaan zie je per ad waarom hij is gekozen, en onder **Niet geselecteerd** waarom andere ads zijn afgevallen.

## Fase 5: Deck controleren en exporteren
- Na het genereren opent het tabblad **2 · Deck**. Per ad: **Goed** / **Af**, vastpinnen, volgorde, de toepassingstekst en "wat je ziet" direct aanpassen, **Tekst herschrijven** (met optionele instructie) en **Vervangen** door een alternatief.
- **Exporteren**: PowerPoint (importeer in Canva via Maken → Importeren), ZIP met alle creatives, CSV voor Canva Bulk Create, of Markdown. Afgekeurde ads gaan niet mee.
- **Opnieuw genereren** vanaf de briefing: vastgepinde ads blijven staan, afgekeurde komen niet terug.
