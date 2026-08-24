import { Router } from "express";
import { z } from "zod";
import { SocketEvent, FEATURE_CATEGORY_LABEL, type FeatureCategory } from "@ac/shared";
import { conflict, notFound, unprocessable } from "../lib/errors.js";
import { prisma } from "../lib/prisma.js";
import { requireTeam } from "../middleware/auth.js";
import { validate } from "../middleware/validate.js";
import { actionLimiter } from "../middleware/rateLimit.js";
import { asyncHandler } from "../middleware/errorHandler.js";
import { snapshot } from "../services/eventEngine.js";
import { announceBalance, applyLedgerEntry, inCreditTransaction } from "../services/credits.js";
import { publish } from "../realtime/gateway.js";
import { recordActivity } from "../services/activity.js";

export const storeRouter = Router();

/** Feature Store catalogue for the caller's track (global items + track-specific). */
storeRouter.get(
  "/",
  requireTeam,
  asyncHandler(async (req, res) => {
    const team = await prisma.team.findUniqueOrThrow({
      where: { id: req.membership!.teamId },
      select: { trackId: true },
    });
    const features = await prisma.feature.findMany({
      where: { active: true, OR: [{ trackId: null }, { trackId: team.trackId ?? undefined }] },
      orderBy: [{ category: "asc" }, { cost: "asc" }],
    });
    const purchases = await prisma.featurePurchase.findMany({
      where: { teamId: req.membership!.teamId },
      select: { featureId: true },
    });
    const ownedCounts = purchases.reduce<Record<string, number>>((acc, p) => {
      acc[p.featureId] = (acc[p.featureId] ?? 0) + 1;
      return acc;
    }, {});

    const snap = await snapshot();
    res.json({
      categories: FEATURE_CATEGORY_LABEL,
      gates: snap.gates,
      balance: (await prisma.team.findUniqueOrThrow({ where: { id: req.membership!.teamId }, select: { creditBalance: true } }))
        .creditBalance,
      features: features.map((f) => ({ ...f, ownedByTeam: ownedCounts[f.id] ?? 0 })),
      rivals:
        req.query.rivals === "1"
          ? await prisma.team.findMany({
              where: { id: { not: req.membership!.teamId } },
              select: { id: true, name: true },
              take: 50,
            })
          : undefined,
    });
  }),
);

const PurchaseInput = z.object({
  featureId: z.string().min(1),
  targetTeamId: z.string().optional(),
});

/**
 * Purchase flow — every gate is server-side:
 * phase → item active/track → per-team limit → sabotage rules → balance → ledger.
 */
storeRouter.post(
  "/purchase",
  actionLimiter,
  requireTeam,
  validate(PurchaseInput),
  asyncHandler(async (req, res) => {
    const teamId = req.membership!.teamId;
    const { featureId, targetTeamId } = req.body as z.infer<typeof PurchaseInput>;

    const snap = await snapshot();
    if (!snap.gates.storeOpen) throw unprocessable("The Feature Store is only open during PHASE_1 and PHASE_2");

    const feature = await prisma.feature.findUnique({ where: { id: featureId }, include: { track: true } });
    if (!feature || !feature.active) throw notFound("That component is not available");
    const team = await prisma.team.findUniqueOrThrow({ where: { id: teamId }, select: { trackId: true, name: true } });
    if (feature.trackId && feature.trackId !== team.trackId) {
      throw unprocessable("That component is exclusive to another track");
    }

    if (feature.category === "OFFENSIVE_SABOTAGE") {
      if (!targetTeamId) throw unprocessable("Select a rival team to target");
      if (targetTeamId === teamId) throw unprocessable("You cannot sabotage your own team");
      const target = await prisma.team.findUnique({ where: { id: targetTeamId } });
      if (!target) throw notFound("Target team not found");
    } else if (targetTeamId) {
      throw unprocessable("Only sabotage items take a target");
    }

    const owned = await prisma.featurePurchase.count({ where: { teamId, featureId } });
    if (owned >= feature.maxPerTeam) throw unprocessable(`Limit reached — max ${feature.maxPerTeam} per team`);

    const purchase = await inCreditTransaction(async (tx) => {
      const created = await tx.featurePurchase.create({
        data: { featureId, teamId, targetTeamId, costPaid: feature.cost, createdById: req.user!.id },
      });
      const { balanceAfter } = await applyLedgerEntry(tx, teamId, {
        amount: -feature.cost,
        type: "FEATURE_PURCHASE",
        source: `Feature Store: ${feature.name}`,
        reference: created.id,
        createdById: req.user!.id,
      });
      return { created, balanceAfter };
    });

    announceBalance(teamId, purchase.balanceAfter, {
      amount: -feature.cost,
      reason: `Purchased ${feature.name}`,
    });
    publish(
      SocketEvent.StorePurchase,
      { teamId, teamName: team.name, feature: feature.name, category: feature.category as FeatureCategory, at: new Date().toISOString() },
    );
    await recordActivity(
      "PURCHASE",
      `${team.name} bought ${feature.name}${targetTeamId ? ` (targeting ${await targetName(targetTeamId)})` : ""}`,
      { category: feature.category },
    );

    res.status(201).json({ purchase: purchase.created, balance: purchase.balanceAfter });
  }),
);

async function targetName(teamId: string): Promise<string> {
  const t = await prisma.team.findUnique({ where: { id: teamId }, select: { name: true } });
  return t?.name ?? "a rival";
}
