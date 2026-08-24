import { Router } from "express";
import { prisma } from "../lib/prisma.js";
import { readLimiter } from "../middleware/rateLimit.js";
import { asyncHandler } from "../middleware/errorHandler.js";
import { snapshot } from "../services/eventEngine.js";

export const eventRouter = Router();

/** Public event state — drives participant headers, spectator screen and login page. */
eventRouter.get(
  "/state",
  readLimiter,
  asyncHandler(async (_req, res) => {
    const snap = await snapshot();
    const [announcements, activity, teamsCount, submissionsCount] = await Promise.all([
      prisma.announcement.findMany({ orderBy: { createdAt: "desc" }, take: 5 }),
      prisma.activityEvent.findMany({ orderBy: { createdAt: "desc" }, take: 12 }),
      prisma.team.count(),
      prisma.submission.count(),
    ]);
    res.json({
      ...snap,
      announcements,
      activity,
      stats: { teams: teamsCount, submissions: submissionsCount },
    });
  }),
);

/** Recent activity feed (spectator + dashboards). */
eventRouter.get(
  "/activity",
  readLimiter,
  asyncHandler(async (_req, res) => {
    const rows = await prisma.activityEvent.findMany({
      orderBy: { createdAt: "desc" },
      take: 30,
    });
    res.json({ activity: rows });
  }),
);
