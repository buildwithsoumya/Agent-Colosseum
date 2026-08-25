import { Router } from "express";
import { z } from "zod";
import { conflict, forbidden, notFound, unprocessable } from "../lib/errors.js";
import { prisma } from "../lib/prisma.js";
import { inviteCode } from "../lib/rng.js";
import { loadMembership, requireTeam } from "../middleware/auth.js";
import { validate } from "../middleware/validate.js";
import { actionLimiter } from "../middleware/rateLimit.js";
import { asyncHandler } from "../middleware/errorHandler.js";
import { eventConfig, getEvent, snapshot } from "../services/eventEngine.js";
import { applyLedgerEntry, inCreditTransaction } from "../services/credits.js";
import { recordActivity } from "../services/activity.js";

export const teamsRouter = Router();

const teamSelect = {
  id: true,
  name: true,
  code: true,
  creditBalance: true,
  trackId: true,
  track: { select: { key: true, name: true } },
  members: {
    select: { teamRole: true, joinedAt: true, user: { select: { id: true, name: true, email: true } } },
    orderBy: { joinedAt: "asc" as const },
  },
  problemStatements: { select: { status: true, title: true } },
} as const;

teamsRouter.post(
  "/",
  actionLimiter,
  validate(z.object({ name: z.string().min(2).max(40) })),
  asyncHandler(async (req, res) => {
    if (!req.user) return void res.status(401).json({ error: "Auth required" });
    const existing = await prisma.teamMember.findUnique({ where: { userId: req.user.id } });
    if (existing) throw conflict("You are already in a team");

    const team = await inCreditTransaction(async (tx) => {
      let code = inviteCode();
      while (await tx.team.findUnique({ where: { code } })) code = inviteCode();
      const created = await tx.team.create({
        data: {
          name: (req.body as { name: string }).name,
          code,
          members: { create: { userId: req.user!.id, teamRole: "CAPTAIN" } },
        },
      });
      // opening balance lands immediately on team creation during an active event
      const event = await getEvent();
      if (event.status !== "SETUP") {
        const config = eventConfig(event);
        await applyLedgerEntry(tx, created.id, {
          amount: config.openingBalanceCc,
          type: "STARTING_BALANCE",
          source: "Event opening balance",
          createdById: req.user!.id,
        });
      }
      return created;
    });

    await recordActivity("TEAM", `Team "${team.name}" entered the arena`);
    const full = await prisma.team.findUniqueOrThrow({ where: { id: team.id }, select: teamSelect });
    res.status(201).json({ team: full });
  }),
);

teamsRouter.post(
  "/join",
  actionLimiter,
  validate(z.object({ code: z.string().length(6) })),
  asyncHandler(async (req, res) => {
    if (!req.user) return void res.status(401).json({ error: "Auth required" });
    const existing = await prisma.teamMember.findUnique({ where: { userId: req.user.id } });
    if (existing) throw conflict("You are already in a team");

    const { code } = req.body as { code: string };
    const team = await prisma.team.findUnique({ where: { code: code.toUpperCase() } });
    if (!team) throw notFound("No team with that invite code");

    const memberCount = await prisma.teamMember.count({ where: { teamId: team.id } });
    if (memberCount >= 4) throw unprocessable("That team is full");

    await prisma.teamMember.create({ data: { teamId: team.id, userId: req.user.id } });
    const full = await prisma.team.findUniqueOrThrow({ where: { id: team.id }, select: teamSelect });
    res.json({ team: full });
  }),
);

teamsRouter.get(
  "/me",
  requireTeam,
  asyncHandler(async (req, res) => {
    const team = await prisma.team.findUniqueOrThrow({
      where: { id: req.membership!.teamId },
      select: teamSelect,
    });
    res.json({ team, teamRole: req.membership!.teamRole });
  }),
);

teamsRouter.patch(
  "/me/track",
  requireTeam,
  validate(z.object({ trackKey: z.string() })),
  asyncHandler(async (req, res) => {
    if (!req.membership || req.membership.teamRole !== "CAPTAIN") throw forbidden("Only the captain can set the track");
    const snap = await snapshot();
    if (snap.phase !== "PHASE_0") throw unprocessable("Track selection closes after onboarding");

    const track = await prisma.track.findUnique({ where: { key: (req.body as { trackKey: string }).trackKey } });
    if (!track || !track.active) throw notFound("Unknown track");

    const team = await prisma.team.update({
      where: { id: req.membership!.teamId },
      data: { trackId: track.id },
      select: teamSelect,
    });
    res.json({ team });
  }),
);

teamsRouter.get(
  "/me/transactions",
  requireTeam,
  asyncHandler(async (req, res) => {
    const rows = await prisma.creditTransaction.findMany({
      where: { teamId: req.membership!.teamId },
      orderBy: { createdAt: "desc" },
      take: 100,
    });
    const earned = rows.filter((r) => r.amount > 0).reduce((s, r) => s + r.amount, 0);
    const spent = rows.filter((r) => r.amount < 0).reduce((s, r) => s - r.amount, 0);
    res.json({ transactions: rows, earned, spent });
  }),
);

void loadMembership; // applied globally in app.ts
