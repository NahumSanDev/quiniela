BEGIN;

ALTER TABLE "Match" ADD COLUMN "extraTime" BOOLEAN;
ALTER TABLE "Match" ADD COLUMN "penaltyShootout" BOOLEAN;

ALTER TABLE "Prediction" ADD COLUMN "extraTime" BOOLEAN;
ALTER TABLE "Prediction" ADD COLUMN "penaltyShootout" BOOLEAN;

COMMIT;
