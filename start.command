#!/bin/bash
# Dubbelklik dit bestand (Mac) om de app bij te werken en te starten.
cd "$(dirname "$0")"
echo "▶ Nieuwste versie ophalen…"
git pull --ff-only || echo "  (bijwerken overgeslagen)"
echo "▶ Onderdelen installeren…"
npm install --no-fund --no-audit
[ -f .env ] || cp .env.example .env
echo "▶ Browser voor de scraper controleren (eerste keer ±150 MB)…"
npx playwright install chromium
echo "▶ Database bijwerken…"
npx prisma migrate deploy
npx prisma generate >/dev/null
echo "▶ App starten op http://localhost:3000 (sluit dit venster om te stoppen)"
(sleep 6 && open http://localhost:3000) &
npm run dev
