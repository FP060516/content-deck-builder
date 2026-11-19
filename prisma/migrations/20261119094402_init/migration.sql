-- CreateTable
CREATE TABLE "Client" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "websiteUrl" TEXT NOT NULL DEFAULT '',
    "industry" TEXT NOT NULL DEFAULT '',
    "country" TEXT NOT NULL DEFAULT 'NL',
    "language" TEXT NOT NULL DEFAULT 'nl',
    "positioning" TEXT NOT NULL DEFAULT 'mid',
    "toneSummary" TEXT NOT NULL DEFAULT '',
    "toneExamples" TEXT NOT NULL DEFAULT '[]',
    "products" TEXT NOT NULL DEFAULT '[]',
    "usps" TEXT NOT NULL DEFAULT '[]',
    "forbiddenClaims" TEXT NOT NULL DEFAULT '[]',
    "competitors" TEXT NOT NULL DEFAULT '[]',
    "adLibraryPage" TEXT NOT NULL DEFAULT '',
    "gapAnalysisNotes" TEXT NOT NULL DEFAULT '',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "Deck" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "clientId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "briefing" TEXT NOT NULL DEFAULT '{}',
    "status" TEXT NOT NULL DEFAULT 'draft',
    "round" INTEGER NOT NULL DEFAULT 1,
    "summary" TEXT NOT NULL DEFAULT '',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Deck_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "AdCandidate" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "deckId" TEXT NOT NULL,
    "adId" TEXT NOT NULL,
    "advertiser" TEXT NOT NULL,
    "pageName" TEXT NOT NULL DEFAULT '',
    "mediaType" TEXT NOT NULL DEFAULT 'image',
    "contentType" TEXT,
    "bodyText" TEXT NOT NULL DEFAULT '',
    "startDate" DATETIME,
    "activeDays" INTEGER,
    "variantCount" INTEGER NOT NULL DEFAULT 1,
    "country" TEXT NOT NULL DEFAULT '',
    "sourceQuery" TEXT NOT NULL DEFAULT '',
    "mediaUrlOriginal" TEXT NOT NULL DEFAULT '',
    "mediaUrlLocal" TEXT NOT NULL DEFAULT '',
    "posterUrl" TEXT NOT NULL DEFAULT '',
    "mediaHash" TEXT NOT NULL DEFAULT '',
    "scores" TEXT NOT NULL DEFAULT '{}',
    "scoreTotal" REAL NOT NULL DEFAULT 0,
    "scoreReason" TEXT NOT NULL DEFAULT '',
    "rejected" BOOLEAN NOT NULL DEFAULT false,
    "rejectReason" TEXT NOT NULL DEFAULT '',
    "round" INTEGER NOT NULL DEFAULT 1,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "AdCandidate_deckId_fkey" FOREIGN KEY ("deckId") REFERENCES "Deck" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "DeckItem" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "deckId" TEXT NOT NULL,
    "candidateId" TEXT NOT NULL,
    "contentType" TEXT NOT NULL,
    "position" INTEGER NOT NULL,
    "whatYouSee" TEXT NOT NULL DEFAULT '',
    "application" TEXT NOT NULL DEFAULT '',
    "whyThis" TEXT NOT NULL DEFAULT '',
    "funnelTag" TEXT NOT NULL DEFAULT '',
    "status" TEXT NOT NULL DEFAULT 'pending',
    "pinned" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "DeckItem_deckId_fkey" FOREIGN KEY ("deckId") REFERENCES "Deck" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "DeckItem_candidateId_fkey" FOREIGN KEY ("candidateId") REFERENCES "AdCandidate" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "UsedAdvertiser" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "clientId" TEXT NOT NULL,
    "deckId" TEXT NOT NULL,
    "advertiser" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "UsedAdvertiser_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "UsedAdvertiser_deckId_fkey" FOREIGN KEY ("deckId") REFERENCES "Deck" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "BriefingPreset" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "briefing" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateIndex
CREATE UNIQUE INDEX "Client_slug_key" ON "Client"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "AdCandidate_deckId_adId_key" ON "AdCandidate"("deckId", "adId");

-- CreateIndex
CREATE UNIQUE INDEX "UsedAdvertiser_clientId_deckId_advertiser_key" ON "UsedAdvertiser"("clientId", "deckId", "advertiser");
