import { Prisma, type CreditTransactionType } from "@prisma/client";

import { SocketEvent } from "@ac/shared";
import { badRequest } from "../lib/errors.js";
import { prisma } from "../lib/prisma.js";
import { publish } from "../realtime/gateway.js";

type Tx = Parameters<Parameters<typeof prisma.$transaction>[0]>[0];

export interface LedgerEntryInput {
  amount: number; // signed
  type: CreditTransactionType;
  source: string;
  reference?: string;
  createdById?: string;
}

/**
 * The single gateway for every credit mutation in the system.
 *
 * Invariants enforced here (all inside one DB transaction):
 *  1. The team row is locked (SELECT ... FOR UPDATE) — no lost updates under concurrency.
 *  2. Balances can never go negative through this path.
 *  3. An append-only CreditTransaction row records balanceAfter for auditability.
 *  4. The cached Team.creditBalance always equals ledger truth after commit.
 */
export async function applyLedgerEntry(
  tx: Tx,
  teamId: string,
  entry: LedgerEntryInput,
): Promise<{ balanceAfter: number; transactionId: string }> {
  const rows = await tx.$queryRaw<{ id: string; creditBalance: number }[]>`
    SELECT id, "creditBalance" FROM "Team" WHERE id = ${teamId} FOR UPDATE`;
  const row = rows[0];
  if (!row) throw badRequest("Team not found");

  const newBalance = row.creditBalance + entry.amount;
  if (!Number.isInteger(entry.amount)) throw badRequest("Credit amounts must be integers");
  if (newBalance < 0) throw badRequest("Insufficient credits");

  await tx.team.update({ where: { id: teamId }, data: { creditBalance: newBalance } });

  const created = await tx.creditTransaction.create({
    data: {
      teamId,
      amount: entry.amount,
      type: entry.type,
      source: entry.source,
      reference: entry.reference,
      balanceAfter: newBalance,
      createdById: entry.createdById,
    },
  });

  return { balanceAfter: newBalance, transactionId: created.id };
}

/** Convenience wrapper running a unit of work that mutates credits atomically. */
export async function inCreditTransaction<T>(fn: (tx: Tx) => Promise<T>): Promise<T> {
  return prisma.$transaction(fn, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
}

/** Broadcast a balance change to the team room + spectator event room. */
export async function announceBalance(
  teamId: string,
  balanceAfter: number,
  change: { amount: number; reason: string },
): Promise<void> {
  publish(
    SocketEvent.CreditsUpdated,
    { teamId, balance: balanceAfter, ...change, at: new Date().toISOString() },
    `team:${teamId}`,
  );
}
