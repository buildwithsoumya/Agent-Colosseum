-- Auth & role model refactor:
--   User.role (ADMIN|MENTOR|PARTICIPANT|SPECTATOR) -> User.globalRole (ADMIN|MENTOR|PARTICIPANT)
--   User.status added (ACTIVE default)
--   TeamMember.isCaptain -> TeamMember.teamRole (MEMBER|CAPTAIN)
--   Invitation table for secure single-use privileged-role invites
-- All existing users are preserved. Former SPECTATOR accounts become PARTICIPANT
-- (spectating never required an account).

-- 1. new enum types
CREATE TYPE "GlobalRole" AS ENUM ('ADMIN', 'MENTOR', 'PARTICIPANT');
CREATE TYPE "UserStatus" AS ENUM ('ACTIVE', 'SUSPENDED');
CREATE TYPE "TeamRole" AS ENUM ('MEMBER', 'CAPTAIN');
CREATE TYPE "InvitableRole" AS ENUM ('MENTOR', 'CAPTAIN');
CREATE TYPE "InvitationState" AS ENUM ('PENDING', 'USED', 'EXPIRED', 'REVOKED');

-- 2. User.role -> User.globalRole (ADMIN/MENTOR/PARTICIPANT preserved; SPECTATOR -> PARTICIPANT)
ALTER TABLE "User" ADD COLUMN "globalRole" "GlobalRole" NOT NULL DEFAULT 'PARTICIPANT';
UPDATE "User" SET "globalRole" = CASE
  WHEN "role" = 'ADMIN' THEN 'ADMIN'::"GlobalRole"
  WHEN "role" = 'MENTOR' THEN 'MENTOR'::"GlobalRole"
  ELSE 'PARTICIPANT'::"GlobalRole"
END;
ALTER TABLE "User" ALTER COLUMN "globalRole" DROP DEFAULT;
ALTER TABLE "User" ALTER COLUMN "globalRole" SET DEFAULT 'PARTICIPANT';
ALTER TABLE "User" DROP COLUMN "role";
DROP TYPE "Role";

-- 3. User.status
ALTER TABLE "User" ADD COLUMN "status" "UserStatus" NOT NULL DEFAULT 'ACTIVE';

-- 4. TeamMember.isCaptain -> teamRole (captains preserved)
ALTER TABLE "TeamMember" ADD COLUMN "teamRole" "TeamRole" NOT NULL DEFAULT 'MEMBER';
UPDATE "TeamMember" SET "teamRole" = 'CAPTAIN' WHERE "isCaptain" = true;
ALTER TABLE "TeamMember" ALTER COLUMN "teamRole" DROP DEFAULT;
ALTER TABLE "TeamMember" ALTER COLUMN "teamRole" SET DEFAULT 'MEMBER';
ALTER TABLE "TeamMember" DROP COLUMN "isCaptain";

-- 5. Invitation
CREATE TABLE "Invitation" (
    "id" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "role" "InvitableRole" NOT NULL,
    "teamId" TEXT,
    "status" "InvitationState" NOT NULL DEFAULT 'PENDING',
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "usedAt" TIMESTAMP(3),
    "usedByUserId" TEXT,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Invitation_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Invitation_tokenHash_key" ON "Invitation"("tokenHash");
CREATE INDEX "Invitation_email_idx" ON "Invitation"("email");

ALTER TABLE "Invitation" ADD CONSTRAINT "Invitation_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON UPDATE CASCADE ON DELETE SET NULL;
ALTER TABLE "Invitation" ADD CONSTRAINT "Invitation_usedByUserId_fkey" FOREIGN KEY ("usedByUserId") REFERENCES "User"("id") ON UPDATE CASCADE ON DELETE SET NULL;
