-- Team join codes: replace plaintext `code` with hashed lookup + encrypted display copy.
-- Existing demo codes remain valid: they are normalized and hashed in-place.

CREATE EXTENSION IF NOT EXISTS pgcrypto;

ALTER TABLE "Team" ADD COLUMN "joinCodeHash" TEXT;
ALTER TABLE "Team" ADD COLUMN "joinCodeCipher" TEXT NOT NULL DEFAULT '';
ALTER TABLE "Team" ADD COLUMN "joinCodeUpdatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- backfill: normalize (uppercase, strip separators) then sha256 — same rules as lib/team-codes.ts
UPDATE "Team"
   SET "joinCodeHash" = encode(
         digest(upper(regexp_replace("code", '[^A-Za-z0-9]', '', 'g')), 'sha256'),
         'hex');

-- display cipher for pre-existing teams is unknowable (plaintext was the only copy);
-- captains of legacy teams can regenerate to obtain a displayable code.
UPDATE "Team" SET "joinCodeCipher" = 'legacy';

ALTER TABLE "Team" ALTER COLUMN "joinCodeHash" SET NOT NULL;
CREATE UNIQUE INDEX "Team_joinCodeHash_key" ON "Team"("joinCodeHash");
ALTER TABLE "Team" DROP COLUMN "code";
