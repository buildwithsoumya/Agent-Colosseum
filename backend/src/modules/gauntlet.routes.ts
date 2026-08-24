import { Router } from "express";
import { requireRole, requireTeam } from "../middleware/auth.js";
import { asyncHandler } from "../middleware/errorHandler.js";
import { gauntletOverview, gauntletStatusForTeam } from "../services/gauntlet.js";

export const gauntletRouter = Router();

/** Live Gauntlet status for the caller's team (job + metrics + score). */
gauntletRouter.get(
  "/me",
  requireTeam,
  asyncHandler(async (req, res) => {
    res.json(await gauntletStatusForTeam(req.membership!.teamId));
  }),
);

/** Admin/operator monitoring feed. */
gauntletRouter.get(
  "/overview",
  requireRole("ADMIN"),
  asyncHandler(async (_req, res) => {
    res.json({ jobs: await gauntletOverview() });
  }),
);
