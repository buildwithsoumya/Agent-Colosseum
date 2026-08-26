import type { Prisma } from "@prisma/client";
import { SocketEvent } from "@ac/shared";
import { prisma } from "../lib/prisma.js";
import { emit as publish } from "../lib/runtime.js";

/**
 * Records a notable happening for the spectator main-stage feed and pushes it live.
 */
export async function recordActivity(
  kind: "PHASE" | "PURCHASE" | "ARENA" | "CASINO" | "GAUNTLET" | "SCORE" | "ANNOUNCEMENT" | "TEAM",
  summary: string,
  detail?: Record<string, unknown>,
): Promise<void> {
  const row = await prisma.activityEvent.create({
    data: { kind, summary, detail: (detail ?? undefined) as Prisma.InputJsonValue | undefined },
  });
  publish(SocketEvent.ActivityNew, {
    id: row.id,
    kind: row.kind,
    summary: row.summary,
    detail: detail ?? null,
    createdAt: row.createdAt,
  });
}
