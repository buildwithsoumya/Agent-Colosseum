-- Role & status model: team-level teamRole, user status, privileged invitations.
-- Enums
CREATE TYPE "UserStatus" AS ENUM ('ACTIVE', 'DEACTIVATED');
CREATE TYPE "TeamRole" AS ENUM ('MEMBER', 'CAPTAIN');
CREATE TYPE "InvitedRole" AS ENUM ('MENTOR', 'CAPTAIN');

-- TeamMember: replace the boolean isCaptain with an explicit teamRole, backfilling first.
ALTER TABLE "TeamMember" ADD COLUMN "teamRole" "TeamRole" NOT NULL DEFAULT 'MEMBER';

UPDATE "TeamMember" SET "teamRole" = 'CAPTAIN' WHERE "isCaptain" = true;
UPDATE "TeamMember" SET "teamRole" = 'MEMBER' WHERE "isCaptain" = false;

ALTER TABLE "TeamMember" DROP COLUMN "isCaptain";

-- User: usable/deactivated status.
ALTER TABLE "User" ADD COLUMN "status" "UserStatus" NOT NULL DEFAULT 'ACTIVE';

-- Invitation table for admin-issued privileged-role invites.
CREATE TABLE "Invitation" (
    "id" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "role" "InvitedRole" NOT NULL,
    "teamId" TEXT,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "usedAt" TIMESTAMP(3),
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Invitation_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Invitation_tokenHash_key" ON "Invitation"("tokenHash");
CREATE INDEX "Invitation_email_idx" ON "Invitation"("email");
CREATE INDEX "Invitation_teamId_idx" ON "Invitation"("teamId");
CREATE INDEX "Invitation_createdById_idx" ON "Invitation"("createdById");

ALTER TABLE "Invitation" ADD CONSTRAINT "Invitation_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Invitation" ADD CONSTRAINT "Invitation_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;