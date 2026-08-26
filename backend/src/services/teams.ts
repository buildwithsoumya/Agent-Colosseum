import type { Prisma, PrismaClient } from "@prisma/client";
import { conflict, notFound, unprocessable } from "../lib/errors.js";
import {
  decryptJoinCode,
  encryptJoinCode,
  formatJoinCode,
  generateJoinCode,
  hashJoinCode,
  isValidNormalizedCode,
  normalizeJoinCode,
} from "../lib/team-codes.js";

type Tx = Prisma.TransactionClient;
type Db = PrismaClient | Tx;

const teamSelect = {
  id: true,
  name: true,
  trackId: true,
  track: { select: { key: true, name: true } },
  joinCodeUpdatedAt: true,
  members: {
    select: { teamRole: true, joinedAt: true, user: { select: { id: true, name: true, email: true } } },
    orderBy: { joinedAt: "asc" as const },
  },
  problemStatements: { select: { status: true, title: true } },
} as const;

async function uniqueRawCode(tx: Tx): Promise<string> {
  for (let attempt = 0; attempt < 10; attempt++) {
    const raw = generateJoinCode();
    if (!(await tx.team.findUnique({ where: { joinCodeHash: hashJoinCode(raw) } }))) return raw;
  }
  throw conflict("Could not allocate a unique join code — try again");
}

/** Create a team; creator becomes CAPTAIN. Raw code is returned exactly once. */
export async function createTeam(
  tx: Tx,
  userId: string,
  name: string,
): Promise<{ teamId: string; joinCode: string }> {
  const raw = await uniqueRawCode(tx);
  const team = await tx.team.create({
    data: {
      name,
      joinCodeHash: hashJoinCode(raw),
      joinCodeCipher: encryptJoinCode(raw),
      members: { create: { userId, teamRole: "CAPTAIN" } },
    },
  });
  return { teamId: team.id, joinCode: raw };
}

/**
 * Join by code inside a caller transaction. The team row is locked
 * (SELECT … FOR UPDATE) so concurrent joins cannot oversubscribe the last slot.
 */
export async function joinByCode(
  tx: Tx,
  userId: string,
  rawCode: string,
  maxTeamSize: number,
): Promise<{ teamId: string; teamName: string; captainName: string | null }> {
  const normalized = normalizeJoinCode(rawCode);
  if (!isValidNormalizedCode(normalized)) throw unprocessable("Invalid or expired team join code.");

  const rows = await tx.$queryRaw<{ id: string }[]>`
    SELECT id FROM "Team" WHERE "joinCodeHash" = ${hashJoinCode(normalized)} FOR UPDATE`;
  const locked = rows[0];
  if (!locked) throw notFound("Invalid or expired team join code.");

  const team = await tx.team.findUniqueOrThrow({
    where: { id: locked.id },
    include: { members: { include: { user: { select: { name: true } } } } },
  });

  const membership = team.members.find((m) => m.userId === userId);
  if (membership) {
    throw conflict(
      membership.teamRole === "CAPTAIN"
        ? "You're already the captain of this team."
        : "You're already a member of this team.",
    );
  }
  if (team.members.length >= maxTeamSize) throw unprocessable("This team is full.");

  await tx.teamMember.create({ data: { teamId: team.id, userId, teamRole: "MEMBER" } });

  const captain = team.members.find((m) => m.teamRole === "CAPTAIN");
  return { teamId: team.id, teamName: team.name, captainName: captain?.user.name ?? null };
}

/** Captain/admin action: old code dies instantly, members are unaffected. */
export async function regenerateJoinCode(tx: Tx, teamId: string): Promise<{ joinCode: string }> {
  const raw = await uniqueRawCode(tx);
  await tx.team.update({
    where: { id: teamId },
    data: { joinCodeHash: hashJoinCode(raw), joinCodeCipher: encryptJoinCode(raw), joinCodeUpdatedAt: new Date() },
  });
  return { joinCode: raw };
}

/** Captain-visible display form ('legacy' pre-migration codes yield null → regenerate). */
export async function displayableCode(db: Db, teamId: string): Promise<string | null> {
  const team = await db.team.findUniqueOrThrow({
    where: { id: teamId },
    select: { joinCodeCipher: true },
  });
  const raw = decryptJoinCode(team.joinCodeCipher);
  return raw ? formatJoinCode(raw) : null;
}

/** Full team view for dashboards (never includes the code itself). */
export async function teamView(db: Db, teamId: string) {
  return db.team.findUniqueOrThrow({ where: { id: teamId }, select: teamSelect });
}
