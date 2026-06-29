BEGIN;

ALTER TABLE "Group" ADD COLUMN IF NOT EXISTS "useExtraBets" BOOLEAN NOT NULL DEFAULT false;

CREATE TABLE "GroupMatchBetConfig" (
    "id" TEXT PRIMARY KEY DEFAULT (now()::text || gen_random_uuid()::text),
    "groupId" TEXT NOT NULL REFERENCES "Group"("id") ON DELETE CASCADE,
    "matchId" INTEGER NOT NULL REFERENCES "Match"("id") ON DELETE CASCADE,
    "totalGoals" BOOLEAN NOT NULL DEFAULT true,
    "bothTeamsScore" BOOLEAN NOT NULL DEFAULT true,
    "cleanSheet" BOOLEAN NOT NULL DEFAULT true,
    "halfTimeScore" BOOLEAN NOT NULL DEFAULT true,
    "firstGoalTeam" BOOLEAN NOT NULL DEFAULT true,
    "firstGoalMinute" BOOLEAN NOT NULL DEFAULT true,
    "redCard" BOOLEAN NOT NULL DEFAULT true,
    "totalCards" BOOLEAN NOT NULL DEFAULT true,
    "extraTime" BOOLEAN NOT NULL DEFAULT true,
    "penaltyShootout" BOOLEAN NOT NULL DEFAULT true,
    UNIQUE("groupId", "matchId")
);

CREATE INDEX idx_group_match_config ON "GroupMatchBetConfig"("groupId", "matchId");

COMMIT;
