import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { PrismaClient } from "@prisma/client";
import { applyLedgerEntry } from "../src/services/credits.js";
import { encryptJoinCode, generateJoinCode, hashJoinCode } from "../src/lib/team-codes.js";

/**
 * Ledger invariants against a real database.
 * Enabled with RUN_DB_TESTS=1 (CI sets it; local demo data stays untouched).
 */
const prisma = new PrismaClient();
const run = process.env.RUN_DB_TESTS === "1";

describe.skipIf(!run)("credit ledger", () => {
  let teamId: string;

  beforeAll(async () => {
    const raw = generateJoinCode();
    const team = await prisma.team.create({
      data: {
        name: `test-ledger-${Date.now()}`,
        joinCodeHash: hashJoinCode(raw),
        joinCodeCipher: encryptJoinCode(raw),
      },
    });
    teamId = team.id;
  });

  afterAll(async () => {
    await prisma.team.deleteMany({ where: { id: teamId } });
    await prisma.$disconnect();
  });

  it("records balanceAfter as an unbroken chain", async () => {
    const r1 = await prisma.$transaction((tx) =>
      applyLedgerEntry(tx, teamId, { amount: 1000, type: "STARTING_BALANCE", source: "test" }),
    );
    const r2 = await prisma.$transaction((tx) =>
      applyLedgerEntry(tx, teamId, { amount: -40, type: "TASK_UNLOCK", source: "test" }),
    );
    const r3 = await prisma.$transaction((tx) =>
      applyLedgerEntry(tx, teamId, { amount: 150, type: "ARENA_REWARD", source: "test" }),
    );

    expect(r1.balanceAfter).toBe(1000);
    expect(r2.balanceAfter).toBe(960);
    expect(r3.balanceAfter).toBe(1110);

    const txs = await prisma.creditTransaction.findMany({
      where: { teamId },
      orderBy: { createdAt: "asc" },
    });
    expect(txs.map((t) => t.balanceAfter)).toEqual([1000, 960, 1110]);
  });

  it("rejects overdrafts and leaves no partial state", async () => {
    await expect(
      prisma.$transaction((tx) =>
        applyLedgerEntry(tx, teamId, { amount: -99999, type: "FEATURE_PURCHASE", source: "test" }),
      ),
    ).rejects.toThrow();
    const team = await prisma.team.findUniqueOrThrow({ where: { id: teamId } });
    expect(team.creditBalance).toBe(1110); // unchanged
    const count = await prisma.creditTransaction.count({ where: { teamId } });
    expect(count).toBe(3);
  });

  it("rejects non-integer amounts", async () => {
    await expect(
      prisma.$transaction((tx) =>
        applyLedgerEntry(tx, teamId, { amount: 10.5, type: "ADMIN_ADJUSTMENT", source: "test" }),
      ),
    ).rejects.toThrow();
  });

  it("keeps cached balance equal to ledger truth", async () => {
    const team = await prisma.team.findUniqueOrThrow({ where: { id: teamId } });
    const agg = await prisma.creditTransaction.aggregate({ where: { teamId }, _sum: { amount: true } });
    expect(team.creditBalance).toBe(agg._sum.amount ?? 0);
  });
});
