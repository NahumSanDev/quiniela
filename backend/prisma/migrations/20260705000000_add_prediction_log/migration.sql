-- CreateTable
CREATE TABLE IF NOT EXISTS "PredictionLog" (
    id SERIAL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "matchId" INTEGER NOT NULL,
    "groupId" TEXT,
    action TEXT NOT NULL,
    before JSONB,
    after JSONB,
    "createdAt" TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS "PredictionLog_userId_matchId_idx" ON "PredictionLog" ("userId", "matchId");
CREATE INDEX IF NOT EXISTS "PredictionLog_createdAt_idx" ON "PredictionLog" ("createdAt");
