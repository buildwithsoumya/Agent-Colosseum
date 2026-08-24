import { Router } from "express";
import { prisma } from "../lib/prisma.js";
import { readLimiter } from "../middleware/rateLimit.js";
import { asyncHandler } from "../middleware/errorHandler.js";
import { notFound } from "../lib/errors.js";

export const tracksRouter = Router();

tracksRouter.get(
  "/",
  readLimiter,
  asyncHandler(async (_req, res) => {
    const tracks = await prisma.track.findMany({
      where: { active: true },
      orderBy: { key: "asc" },
      select: {
        id: true,
        key: true,
        name: true,
        description: true,
        task1Title: true,
        task1Body: true,
        task1UnlockCost: true,
        task2Title: true,
        task2Body: true,
        _count: { select: { teams: true } },
      },
    });
    res.json({ tracks });
  }),
);

tracksRouter.get(
  "/:key",
  readLimiter,
  asyncHandler(async (req, res) => {
    const track = await prisma.track.findUnique({
      where: { key: req.params.key },
      include: {
        tasks: { orderBy: { number: "asc" } },
        features: { where: { active: true }, orderBy: { cost: "asc" } },
        gauntletPayloads: { orderBy: { position: "asc" } },
      },
    });
    if (!track) throw notFound("Unknown track");
    const { gauntletPayloads, ...rest } = track;
    // payload prompts are organiser material; expose count + kinds only
    res.json({
      track: rest,
      gauntletPayloadKinds: [...new Set(gauntletPayloads.map((p) => p.kind))],
    });
  }),
);
