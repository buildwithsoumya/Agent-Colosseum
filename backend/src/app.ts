import express, { type Express } from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import { authOptional, loadMembership } from "./middleware/auth.js";
import { errorHandler } from "./middleware/errorHandler.js";
import { readLimiter } from "./middleware/rateLimit.js";
import { env } from "./config/env.js";

import { authRouter } from "./modules/auth.routes.js";
import { teamsRouter } from "./modules/teams.routes.js";
import { tracksRouter } from "./modules/tracks.routes.js";
import { problemsRouter } from "./modules/problems.routes.js";
import { tasksRouter } from "./modules/tasks.routes.js";
import { storeRouter } from "./modules/store.routes.js";
import { arenaRouter } from "./modules/arena.routes.js";
import { casinoRouter } from "./modules/casino.routes.js";
import { submissionsRouter } from "./modules/submissions.routes.js";
import { gauntletRouter } from "./modules/gauntlet.routes.js";
import { leaderboardRouter } from "./modules/leaderboard.routes.js";
import { eventRouter } from "./modules/event.routes.js";
import { adminRouter } from "./modules/admin.routes.js";

export function createApp(): Express {
  const app = express();

  app.set("trust proxy", 1);
  app.use(cors({ origin: env.CORS_ORIGIN.split(","), credentials: true }));
  app.use(express.json({ limit: "1mb" }));
  app.use(cookieParser());
  app.use(authOptional); // resolves session cookie on every request (optional)
  app.use(loadMembership); // resolves team membership for participant routes

  app.get("/api/health", (_req, res) => {
    res.json({ ok: true, uptimeSec: Math.floor(process.uptime()), phase: null });
  });

  app.use("/api/auth", authRouter);
  app.use("/api/event", eventRouter);
  app.use("/api/tracks", tracksRouter);
  app.use("/api/teams", teamsRouter);
  app.use("/api/problems", problemsRouter);
  app.use("/api/tasks", tasksRouter);
  app.use("/api/store", storeRouter);
  app.use("/api/arena", arenaRouter);
  app.use("/api/casino", casinoRouter);
  app.use("/api/submissions", submissionsRouter);
  app.use("/api/gauntlet", gauntletRouter);
  app.use("/api/leaderboard", readLimiter, leaderboardRouter);
  app.use("/api/admin", adminRouter);

  app.use((_req, res) => res.status(404).json({ error: "Not found" }));
  app.use(errorHandler);
  return app;
}
