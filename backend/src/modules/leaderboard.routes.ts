import { Router } from "express";
import { readLimiter } from "../middleware/rateLimit.js";
import { asyncHandler } from "../middleware/errorHandler.js";
import { getLeaderboard } from "../services/leaderboard.js";

export const leaderboardRouter = Router();

/** Public live leaderboard — rank, team, track, components, final score, CC. */
leaderboardRouter.get(
  "/",
  readLimiter,
  asyncHandler(async (req, res) => {
    const limit = req.query.limit ? Math.min(100, Number(req.query.limit)) : undefined;
    res.json({ entries: await getLeaderboard(limit) });
  }),
);
