BEGIN;

CREATE TYPE "MatchStatus" AS ENUM ('SCHEDULED', 'LIVE', 'FINISHED', 'POSTPONED', 'CANCELLED');

CREATE TABLE "User" (
    "id" TEXT PRIMARY KEY DEFAULT (now()::text || gen_random_uuid()::text),
    "name" TEXT,
    "email" TEXT UNIQUE,
    "password" TEXT,
    "image" TEXT,
    "points" INTEGER NOT NULL DEFAULT 0,
    "isAdmin" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE "Match" (
    "id" SERIAL PRIMARY KEY,
    "externalId" TEXT UNIQUE NOT NULL,
    "homeTeam" TEXT NOT NULL,
    "homeFlag" TEXT NOT NULL,
    "awayTeam" TEXT NOT NULL,
    "awayFlag" TEXT NOT NULL,
    "startTime" TIMESTAMP NOT NULL,
    "homeScore" INTEGER,
    "awayScore" INTEGER,
    "status" "MatchStatus" NOT NULL DEFAULT 'SCHEDULED',
    "groupStage" TEXT,
    "venueName" TEXT,
    "venueCity" TEXT,
    "venueCountry" TEXT,
    "createdAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE "Prediction" (
    "id" SERIAL PRIMARY KEY,
    "userId" TEXT NOT NULL REFERENCES "User"("id") ON DELETE CASCADE,
    "matchId" INTEGER NOT NULL REFERENCES "Match"("id") ON DELETE CASCADE,
    "homeScore" INTEGER NOT NULL,
    "awayScore" INTEGER NOT NULL,
    "points" INTEGER NOT NULL DEFAULT 0,
    "bonus" BOOLEAN NOT NULL DEFAULT FALSE,
    "createdAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE("userId", "matchId")
);

CREATE INDEX idx_user_points_updated ON "User"("points", "updatedAt");
CREATE INDEX idx_match_startTime ON "Match"("startTime");
CREATE INDEX idx_match_status ON "Match"("status");
CREATE INDEX idx_prediction_user_match ON "Prediction"("userId", "matchId");
CREATE INDEX idx_prediction_updated ON "Prediction"("updatedAt");

COMMIT;