import { Router } from "express";
import { z } from "zod";
import type { Prisma } from "@prisma/client";
import { SocketEvent } from "@ac/shared";
import { conflict, forbidden, notFound, unprocessable } from "../lib/errors.js";
import { prisma } from "../lib/prisma.js";
import { joinAttempts } from "../lib/ratelimit.js";
import { loadMembership, requireTeam } from "../middleware/auth.js";
import { validate } from "../middleware/validate.js";
import { actionLimiter } from "../middleware/rateLimit.js";
import { asyncHandler } from "../middleware/errorHandler.js";
import { eventConfig, getEvent, snapshot } from "../services/eventEngine.js";
import {
  createTeam,
  displayableCode,
  joinByCode,
  regenerateJoinCode,
  teamView,
} from "../services/teams.js";
import { emit as publish } from "../lib/runtime.js";
import { recordActivity } from "../services/activity.js";

export const teamsRouter = Router();

/* ------------------------------------------------------------------ create */

teamsRouter.post(
  "/",
  actionLimiter,
  validate(z.object({ name: z.string().min(2).max(40) })),
  asyncHandler(async (req, res) => {
    if (!req.user) return void res.status(401).json({ error: "Auth required" });
    const snap = await snapshot();
    if (!snap.gates.teamCreateOpen || snap.status === "ENDED") {
      throw unprocessable("Team creation is closed for this event.");
    }
    if (await prisma.teamMember.findUnique({ where: { userId: req.user.id } })) {
      throw conflict("You're already a member of a team.");
    }

    const created = await prisma.$transaction((tx) => createTeam(tx, req.user!.id, (req.body as { name: string }).name));
    const full = await teamView(prisma, created.teamId);
    await recordActivity("TEAM", `Team "${full.name}" entered the arena`);
    // raw join code is shown exactly once here; afterwards only the captain can re-display it
    res.status(201).json({ team: full, joinCode: created.joinCode });
  }),
);

/* -------------------------------------------------------------------- join */

const JOIN_FAIL_LIMIT = 10;

teamsRouter.post(
  "/join",
  actionLimiter,
  validate(z.object({ joinCode: z.string().min(4).max(20) })),
  asyncHandler(async (req, res) => {
    if (!req.user) return void res.status(401).json({ error: "Auth required" });
    const userId = req.user.id;

    // brute-force resistance per account
    if ((await joinAttempts.count(userId)) >= JOIN_FAIL_LIMIT) {
      throw unprocessable("Too many failed attempts. Try again in a few minutes.");
    }

    const snap = await snapshot();
    if (!snap.gates.teamJoinOpen || snap.status === "ENDED") {
      throw unprocessable("Team registration is closed for this event.");
    }
    if (await prisma.teamMember.findUnique({ where: { userId } })) {
      throw conflict("You're already a member of a team.");
    }

    const config = eventConfig(await getEvent());
    let joined: Awaited<ReturnType<typeof joinByCode>>;
    try {
      joined = await prisma.$transaction((tx) =>
        joinByCode(tx, userId, (req.body as { joinCode: string }).joinCode, config.maxTeamSize),
      );
    } catch (err) {
      await joinAttempts.increment(userId);
      if ((await joinAttempts.count(userId)) >= JOIN_FAIL_LIMIT) {
        throw unprocessable("Too many failed attempts. Try again in a few minutes.");
      }
      throw err;
    }
    await joinAttempts.clear(userId);

    const memberCount = await prisma.teamMember.count({ where: { teamId: joined.teamId } });
    publish(SocketEvent.TeamMemberJoined, {
      teamId: joined.teamId,
      teamName: joined.teamName,
      memberCount,
      maxTeamSize: config.maxTeamSize,
    });
    publish(SocketEvent.TeamMemberJoined, { teamId: joined.teamId, memberCount, maxTeamSize: config.maxTeamSize }, `team:${joined.teamId}`);
    await recordActivity("TEAM", `${req.user.name} joined "${joined.teamName}"`);

    res.status(201).json({
      team: { id: joined.teamId, name: joined.teamName },
      captainName: joined.captainName,
      yourRole: "MEMBER" as const,
      memberCount,
      maxTeamSize: config.maxTeamSize,
    });
  }),
);

/* --------------------------------------------------------------- team view */

teamsRouter.get(
  "/me",
  requireTeam,
  asyncHandler(async (req, res) => {
    const teamId = req.membership!.teamId;
    const [team, config] = await Promise.all([teamView(prisma, teamId), eventConfig(await getEvent())]);
    const isCaptain = req.membership!.teamRole === "CAPTAIN";
    const joinCode = isCaptain ? await displayableCode(prisma, teamId) : undefined;
    res.json({
      team,
      teamRole: req.membership!.teamRole,
      maxTeamSize: config.maxTeamSize,
      gates: (await snapshot()).gates,
      ...(isCaptain ? { joinCode } : {}),
    });
  }),
);

/* ------------------------------------------------- captain code management */

teamsRouter.post(
  "/me/regenerate-code",
  actionLimiter,
  requireTeam,
  asyncHandler(async (req, res) => {
    const membership = await prisma.teamMember.findUnique({ where: { userId: req.user!.id } });
    if (!membership) throw notFound("No team membership");
    if (membership.teamRole !== "CAPTAIN") throw forbidden("Only the team captain can regenerate the join code.");

    const raw = await prisma.$transaction((tx) => regenerateJoinCode(tx, membership.teamId));
    void logRegen(req.user!.id, membership.teamId);
    res.json({ joinCode: raw.joinCode });
  }),
);

async function logRegen(actorId: string, teamId: string): Promise<void> {
  const { logAdminAction } = await import("../services/audit.js");
  await logAdminAction(actorId, "team.regenerate_join_code", "team", teamId);
}

void loadMembership; // applied globally in app.ts
