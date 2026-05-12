-- Quiniela Mundial Database Schema
-- PostgreSQL Migration

BEGIN;

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

CREATE TABLE "User" (
    "id" SERIAL PRIMARY KEY,
    "email" VARCHAR(255) UNIQUE NOT NULL,
    "name" VARCHAR(255) NOT NULL,
    "avatarUrl" VARCHAR(500),
    "points" INTEGER DEFAULT 0,
    "createdAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_user_points_updated ON "User"("points", "updatedAt");

CREATE TABLE "Match" (
    "id" SERIAL PRIMARY KEY,
    "externalId" VARCHAR(100) UNIQUE NOT NULL,
    "homeTeam" VARCHAR(100) NOT NULL,
    "homeFlag" VARCHAR(255) NOT NULL,
    "awayTeam" VARCHAR(100) NOT NULL,
    "awayFlag" VARCHAR(255) NOT NULL,
    "startTime" TIMESTAMP NOT NULL,
    "homeScore" INTEGER,
    "awayScore" INTEGER,
    "status" VARCHAR(20) DEFAULT 'SCHEDULED',
    "groupStage" VARCHAR(50),
    "createdAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_match_startTime ON "Match"("startTime");
CREATE INDEX idx_match_status ON "Match"("status");

CREATE TABLE "Prediction" (
    "id" SERIAL PRIMARY KEY,
    "userId" INTEGER NOT NULL REFERENCES "User"("id") ON DELETE CASCADE,
    "matchId" INTEGER NOT NULL REFERENCES "Match"("id") ON DELETE CASCADE,
    "homeScore" INTEGER NOT NULL,
    "awayScore" INTEGER NOT NULL,
    "points" INTEGER DEFAULT 0,
    "bonus" BOOLEAN DEFAULT FALSE,
    "createdAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE("userId", "matchId")
);

CREATE INDEX idx_prediction_user_match ON "Prediction"("userId", "matchId");
CREATE INDEX idx_prediction_updated ON "Prediction"("updatedAt");

COMMIT;