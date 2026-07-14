-- AlterTable
ALTER TABLE "Match" ADD COLUMN IF NOT EXISTS "regularTimeHomeScore" INTEGER;
ALTER TABLE "Match" ADD COLUMN IF NOT EXISTS "regularTimeAwayScore" INTEGER;
