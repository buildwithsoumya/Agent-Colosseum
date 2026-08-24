import type { Prisma } from "@prisma/client";
import { prisma } from "../lib/prisma.js";

/** Append-only admin audit trail. Never throws — auditing must not break flows. */
export async function logAdminAction(
  actorId: string | undefined,
  action: string,
  targetType?: string,
  targetId?: string,
  detail?: Record<string, unknown>,
): Promise<void> {
  try {
    const actor = actorId
      ? await prisma.user.findUnique({ where: { id: actorId }, select: { email: true } })
      : null;
    await prisma.adminAction.create({
      data: {
        actorId,
        actorEmail: actor?.email,
        action,
        targetType,
        targetId,
        detail: (detail ?? undefined) as Prisma.InputJsonValue | undefined,
      },
    });
  } catch {
    // swallow — audit is best-effort to avoid blocking critical event operations
  }
}
