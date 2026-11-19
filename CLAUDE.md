# Content Deck Builder – projectgeheugen

Lokale webapp voor een e-commerce marketingbureau. Doel: een "content deck" maken voor een klant (webshop). Dat is een lijst met bestaande Meta Ad Library-ads als inspiratie, met per ad een Ad Library-link, een lokaal gedownloade creative en 1–2 zinnen toepassingstekst in de tone of voice van de klant, met echte productnamen. Het deck gaat daarna naar Canva.

Flow: klant kiezen → briefing aanklikken → "Genereer" → deck controleren → exporteren.
Denk als een **e-commerce performance marketeer**: funnelfase, doel, periode en angle bepalen de zoektermen, de ranking en de teksten.

## Harde lessen uit het handwerk (niet negeren)
1. Bron is de Meta Ad Library. In EU-landen (NL, BE, DE, IE, FR) zijn ook inactieve ads zichtbaar. URL-parameters: `country`, `q`, `search_type=keyword_unordered|keyword_exact_phrase`, `media_type=all|image|video`, `active_status=all`, `start_date[min]`, `start_date[max]`. **Een deck voor december zoekt in de ads die vorig jaar in december liepen.** Dat is de belangrijkste instelling.
2. Engelstalige inspiratie zoek je met `country=IE`. VS-merken zijn soms niet zichtbaar in de EU: meld dat en sla ze over.
3. Zoek op thema, niet op merknaam. Voor een specifiek merk gebruik je `keyword_exact_phrase` en filter je daarna op adverteerder.
4. fbcdn-links verlopen na een paar dagen. Download de media meteen en gebruik de lokale kopie. Het origineel blijft als reserve.
5. Media-URL komt direct uit de kaart: `video.src`, `video.poster`, of `img` met `naturalWidth > 250`. Het ad-detailverzoek niet parsen, daar loopt data van naburige ads door elkaar.
6. Kaartdetectie: zoek naar de tekst `Library ID: \d+` of `Bibliotheek-ID: \d+`. Loop omhoog door de parents tot er meer dan één ID in zit, en neem de laatste parent die nog "Sponsored/Gesponsord" plus media bevat. Scroll 6–8× met ongeveer 1,5 s pauze.
7. Ruis eruit: musea, B2B (Alibaba, groothandel), dramaseries, apps, dropshipping. Claude classificeert op relevantie voor merk en branche.
8. Maximaal X ads per adverteerder (standaard 2). Merken uit eerdere decks van dezelfde klant worden standaard uitgesloten.
9. Niet alleen de eigen branche: de slider "inspiratiebreedte" gaat van directe concurrenten tot out of the box.
10. De toepassingstekst maakt het deck waardevol: echte productnamen van de klant, hun tone of voice, en niets beloven wat ze niet verkopen.
11. Gat-analyse: bekijk eerst de eigen ads van de klant. De gaten wegen mee in de ranking en komen in de samenvatting.
12. Winnaars-proxy: veel actieve dagen en meerdere varianten of ID's wegen zwaar mee.
13. AI-content: Toestaan / Vermijden / Mix. Het deck mag nooit vanzelf alleen uit AI-content bestaan.

## Stack
- Next.js 15 (App Router, Turbopack) + TypeScript + Tailwind v4. UI-componenten in shadcn-stijl staan met de hand in `src/components/ui` (Radix + cmdk).
- SQLite via Prisma 6 (`prisma/dev.db`). JSON-velden staan als `String` opgeslagen (geparsed met zod in `src/lib`).
- Later: Playwright-worker met een job-queue in de DB plus SSE (fase 2), de Anthropic SDK (fase 3/4), en pptxgenjs (fase 5).
- UI-teksten in het Nederlands, code in het Engels.
- Model via `.env`: `ANTHROPIC_MODEL=claude-sonnet-5-5`, `ANTHROPIC_MODEL_COPY=claude-opus-5-5`.
- Media komen later in `storage/media/<klant>/<deck>/<adId>.<ext>` en worden geserveerd via `/media/...`.
- Prompts komen later in `/prompts/*.md`, met JSON-output die met zod wordt gevalideerd.

## Codekaart
- `prisma/schema.prisma`: Client, Deck, AdCandidate, DeckItem, UsedAdvertiser, BriefingPreset.
- `src/lib/briefing/options.ts`: alle keuzelijsten (funnel, doelen, angles, contenttypes, landen, branches).
- `src/lib/briefing/moments.ts`: feestdagen en momenten met datumberekening per jaar (Pasen-computus, n-de weekdag, tabellen voor Ramadan, Suikerfeest, Chinees Nieuwjaar en toernooien).
- `src/lib/briefing/search-window.ts`: periode → doelperiode → zoekvenster in de Ad Library.
- `src/lib/briefing/schema.ts`: zod-schema van de briefing en de standaardwaarden.
- `src/lib/briefing/presets.ts`: ingebouwde presets.
- `src/lib/adlibrary/url.ts`: bouwt Ad Library-URL's.
- `src/lib/adsource/`: `types.ts` (AdSource-interface, RawAd), `parse.ts` (kaarttekst → ID, actief, datums, dagen, varianten; EN+NL), `extract-in-page.ts` (draait IN de pagina, kaartdetectie volgens les 5/6, moet zelfstandig blijven), `playwright-source.ts` (7× scrollen, 1,5 s pauze, ≥5 s tussen zoekopdrachten, cookiebanner), `cache.ts` (24 uur, sleutel = zoek-URL).
- `src/lib/media/`: download naar `storage/media/<klant>/<map>/<adId>.<ext>`; `src/app/media/[...path]/route.ts` serveert ze (met Range voor video).
- `src/lib/jobs/`: job-queue in de DB (`Job`), worker draait in het Next-serverproces (gestart in `src/instrumentation.ts`, één taak tegelijk), `scrape.ts` = taak; SSE via `/api/jobs/[id]/events`.
- `src/app/scraper/`: testscherm met live voortgang en contactsheet.
- `src/lib/site/crawl.ts`: leest de webshop (homepage + max. 5 merk/servicepagina's, robots.txt, 0,7 s pauze) en producten via Shopify `/products.json`, WooCommerce Store API of JSON-LD.
- `src/lib/llm/claude.ts`: `callStructured()` = één Claude-call met prompt uit `/prompts/*.md` (systeem en user gescheiden door `---USER---`, `{{vars}}`), zod-schema via structured outputs, refusal-fallback aan, kosten per call. `setClaudeRunnerForTests()` voor tests.
- `src/lib/settings.ts` + `/settings`: API-sleutel en modellen in de DB (tabel `Setting`), `.env` als terugval.
- `src/lib/jobs/profile.ts`: taak "profile" = crawl → profielvoorstel → eigen ads (exacte zin, gefilterd op adverteerder) → gat-analyse (met tot 6 creatives als beeld). `src/lib/profile/` = schema's, `gapToNotes`, `buildPatch` (lijsten samenvoegen, nooit overschrijven).
- `src/app/clients/profile-assistant.tsx`: kaart in het klantformulier; voorstel per onderdeel aanvinken → in formulier → gebruiker slaat op.
- `src/components/job-panel.tsx`: `useJob` (SSE) + `JobPanel`, gedeeld door scraper en profiel.
- `src/lib/jobs/generate.ts`: taak "generate" (de Genereer-knop). Stappen: zoekplan (Claude, `prompts/search-plan.md`) → `sanitizePlan` (alleen gekozen markten, nooit de klantnaam, concurrenten exact bij breedte 0) → elke zoekterm × elk zoekvenster ophalen (max. 16 zoekopdrachten, 30 ads per stuk, cache) → voorfilter (geen media, eigen ads, uitgesloten/eerder gebruikte merken) → thumbnails downloaden → classificatie per 10 met beelden (Claude, effort low, `prompts/classify.md`) → `selectAds` → video's van gekozen ads downloaden → toepassingsteksten + samenvatting (copy-model, `prompts/application.md`) → in één transactie opslaan (AdCandidate met reden van afwijzing, DeckItem, UsedAdvertiser, deck → review). Bij fout/annuleren gaat het deck terug naar draft of review.
- `src/lib/pipeline/`: `rank.ts` (pure logica: `winnerScore`, `scoreOf` = 0,35 relevantie + 0,25 winnaar + 0,2 gat + 0,2 kwaliteit, `aiCap`, `selectAds`, `forbiddenHits`), `describe.ts` (briefing/klant als tekst voor prompts), `schemas.ts`.
- `src/app/decks/[id]/deck-results.tsx`: eerste resultatenweergave onder de briefing (voortgang, samenvatting, items per contenttype, "waarom niet?"). Bewerken en exports = fase 5.
- `src/components/option-picker.tsx`: de dropdown-balk (doorzoekbaar, gegroepeerd, multi-select met chips).
- `src/app/decks/[id]/briefing-form.tsx`: het briefingscherm.

## Gekozen standaarden (fase 1)
- **Zoekvenster "auto"**: de doelperiode is het eerstvolgende voorkomen (eindigt op of na vandaag). Het zoekvenster is hetzelfde moment **vorig jaar**, opnieuw berekend voor verschuivende feestdagen, met **14 dagen aanloop** ervoor. Dat aantal is instelbaar.
- **Evergreen** zoekt standaard in de laatste 90 dagen.
- **Eigen datumbereik**: in de toekomst gaat het één jaar terug. Ligt het volledig in het verleden, dan wordt het bereik zelf gebruikt.
- **Salesperiode** (jan en jul) geeft twee zoekvensters. Een periode kan dus meerdere vensters hebben.
- Datums die per jaar verschillen en niet te berekenen zijn (Ramadan, Suikerfeest, Chinees Nieuwjaar, Prime Day, toernooien) staan in tabellen voor 2023–2030. Benaderingen zijn gemarkeerd met `approximate`.
- Intocht Sinterklaas: als benadering de 3e zaterdag van november.
- Vaderdag NL is de 3e zondag van juni, Vaderdag BE de 2e zondag. Moederdag Antwerpen is 15 augustus.
- Inspiratiebreedte 0–3: 0 = directe concurrenten, 1 = eigen branche (standaard), 2 = aangrenzende branches, 3 = alles.
- Standaardmarkten: NL + BE. Max. 2 per adverteerder. Merken uit eerdere decks zijn uitgesloten. AI-content op Mix. Positionering: zelfde niveau.
- "×2 overvragen" staat standaard aan.

## Huisstijl
- Stijl van shortcommerce.nl (eigen bureau): alleen donker, bijna zwart (#050506), witte tekst, neongroen accent #00df82 / #2cc295, groene gloed bovenaan (`.sc-glow`), pil-vormige knoppen/nav/badges, kaarten rounded-3xl. Fonts: Plus Jakarta Sans (koppen) + Fustat (tekst). Tokens in `src/app/globals.css`.
- Gebruiker is niet technisch: `start.command` (dubbelklik op Mac) haalt de nieuwste versie op, installeert, migreert en start de app.

## Fase 2-notities
- Vanuit de cloudomgeving geeft facebook.com geen resultaten (datacenter-IP). Niet omzeilen (geen UA-spoofing). Testen gaat tegen `tests/fixtures/adlib/index.html`; `AD_LIBRARY_FIXTURE_URL` laat de app die pagina gebruiken. Echt scrapen gebeurt op de Mac van de gebruiker.
- De worker houdt oude code vast tijdens `next dev`: herstart de server na wijzigingen in `src/lib/jobs` of `src/lib/adsource`.
- `npm test` gebruikt Playwright-chromium (geïnstalleerd door `start.command`).

## Fase 3-notities
- Analyse-model = instelling `anthropicModel` (standaard Sonnet 5.5), teksten = `anthropicModelCopy` (Opus 5.5). Effort `medium`.
- Zonder API-sleutel werkt crawlen en eigen ads ophalen wel; analyse wordt overgeslagen met een duidelijke melding.
- Concurrenten komen uit de algemene kennis van Claude en worden als suggestie getoond.
- Vanuit de cloudomgeving is er geen API-sleutel: echte Claude-calls zijn alleen op de Mac van de gebruiker getest.

## Fase 4-notities
- Cache-sleutel krijgt `#fixture=` als `AD_LIBRARY_FIXTURE_URL` aan staat, zodat testdata nooit echte zoekresultaten vervangt.
- Opnieuw genereren vervangt de resultaten van het deck (de UI vraagt bevestiging) en verhoogt `round`.
- Classificatiebudget: max(20, min(90, doel × 3)) ads, gekozen op winnaarssignalen.

## Werkwijze
Bouw in fases en stop na elke fase met testinstructies. Tests draai je met `npm test` (vitest).
Fase 1 = fundament ✅ · 2 = scraper ✅ · 3 = klantprofiel ✅ · 4 = pipeline ✅ · 5 = deckscherm en exports · 6 = afwerking.
