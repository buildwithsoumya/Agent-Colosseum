import { Router } from "express";
import { z } from "zod";
import { ProblemStatementStatus } from "@ac/shared";
import { badRequest, conflict, notFound, unprocessable } from "../lib/errors.js";
import { prisma } from "../lib/prisma.js";
import { requireRole, requireTeam } from "../middleware/auth.js";
import { validate } from "../middleware/validate.js";
import { actionLimiter } from "../middleware/rateLimit.js";
import { asyncHandler } from "../middleware/errorHandler.js";
import { logAdminAction } from "../services/audit.js";
import { recordActivity } from "../services/activity.js";

export const problemsRouter = Router();

const UpsertInput = z.object({
  title: z.string().min(4).max(120),
  body: z.string().min(20).max(4000),
});

const EDITABLE_STATUSES: ProblemStatementStatus[] = ["DRAFT", "REJECTED", "CHANGES_REQUESTED"];

/** Participant: create/update their problem statement (draft). */
problemsRouter.put(
  "/me",
  actionLimiter,
  requireTeam,
  validate(UpsertInput),
  asyncHandler(async (req, res) => {
    const teamId = req.membership!.teamId;
    const team = await prisma.team.findUniqueOrThrow({ where: { id: teamId }, select: { trackId: true } });
    if (!team.trackId) throw unprocessable("Select a track before writing your problem statement");

    const existing = await prisma.problemStatement.findUnique({ where: { teamId } });
    if (existing && !EDITABLE_STATUSES.includes(existing.status)) {
      throw conflict(`Problem statement is ${existing.status.toLowerCase()} and can no longer be edited`);
    }

    const ps = existing
      ? await prisma.problemStatement.update({
          where: { id: existing.id },
          data: {
            title: (req.body as z.infer<typeof UpsertInput>).title,
            body: (req.body as z.infer<typeof UpsertInput>).body,
            status: "DRAFT",
            mentorNote: null,
          },
        })
      : await prisma.problemStatement.create({
          data: {
            teamId,
            trackId: team.trackId,
            title: (req.body as z.infer<typeof UpsertInput>).title,
            body: (req.body as z.infer<typeof UpsertInput>).body,
          },
        });
    res.json({ problemStatement: ps });
  }),
);

problemsRouter.post(
  "/me/submit",
  actionLimiter,
  requireTeam,
  asyncHandler(async (req, res) => {
    const ps = await prisma.problemStatement.findUnique({ where: { teamId: req.membership!.teamId } });
    if (!ps) throw notFound("Write your problem statement first");
    if (!EDITABLE_STATUSES.includes(ps.status)) {
      throw conflict(`Problem statement is ${ps.status.toLowerCase()} — only drafts can be submitted`);
    }
    if (ps.status === "SUBMITTED") throw conflict("Already submitted — waiting for review");
    const updated = await prisma.problemStatement.update({
      where: { id: ps.id },
      data: { status: "SUBMITTED", submittedAt: new Date() },
    });
    await recordActivity("TEAM", `${await teamName(req.membership!.teamId)} submitted a problem statement`);
    res.json({ problemStatement: updated });
  }),
);

problemsRouter.get(
  "/me",
  requireTeam,
  asyncHandler(async (req, res) => {
    const ps = await prisma.problemStatement.findUnique({
      where: { teamId: req.membership!.teamId },
      include: { track: { select: { key: true, name: true } } },
    });
    res.json({ problemStatement: ps });
  }),
);

/* --------------------------------------------------------------- review side */

const ReviewInput = z.object({
  decision: z.enum(["APPROVE", "REJECT", "REQUEST_CHANGES"]),
  note: z.string().max(2000).optional(),
});

async function review(psId: string, decision: string, note: string | undefined, actorId: string, actorEmail: string) {
  const ps = await prisma.problemStatement.findUnique({ where: { id: psId }, include: { team: true } });
  if (!ps) throw notFound("Problem statement not found");
  if (ps.status === "APPROVED") throw conflict("Already approved");

  const status =
    decision === "APPROVE" ? "APPROVED" : decision === "REJECT" ? "REJECTED" : "CHANGES_REQUESTED";

  const updated = await prisma.problemStatement.update({
    where: { id: psId },
    data: { status, mentorNote: note, reviewedById: actorId, reviewedAt: new Date() },
  });

  if (status === "APPROVED") {
    await recordActivity("TEAM", `Problem statement approved for "${ps.team.name}"`);
  }
  void logAdminAction(actorId, `problem.${decision.toLowerCase()}`, "problem_statement", psId, {
    team: ps.team.name,
    note,
    by: actorEmail,
  });
  return updated;
}

/** Mentor queue — mentors see their assigned track first but may act across tracks. */
problemsRouter.get(
  "/queue",
  requireRole("MENTOR", "ADMIN"),
  asyncHandler(async (req, res) => {
    const statusFilter = (req.query.status as ProblemStatementStatus | undefined)?.toUpperCase();
    const rows = await prisma.problemStatement.findMany({
      where: {
        ...(statusFilter ? { status: statusFilter as ProblemStatementStatus } : {}),
        ...(req.user!.role === "MENTOR" && req.query.mine === "1"
          ? { track: { users: { some: { id: req.user!.id } } } }
          : {}),
      },
      orderBy: { updatedAt: "asc" },
      include: {
        team: { select: { name: true } },
        track: { select: { key: true, name: true } },
      },
    });
    res.json({ submissions: rows });
  }),
);

problemsRouter.post(
  "/:id/review",
  actionLimiter,
  requireRole("MENTOR", "ADMIN"),
  validate(ReviewInput),
  asyncHandler(async (req, res) => {
    const { decision, note } = req.body as z.infer<typeof ReviewInput>;
    if (decision !== "APPROVE" && !note) throw badRequest("A note is required when rejecting or requesting changes");
    const psId = req.params.id;
    if (!psId) throw badRequest("Missing problem statement id");
    const updated = await review(psId, decision, note, req.user!.id, req.user!.email);
    res.json({ problemStatement: updated });
  }),
);

async function teamName(teamId: string): Promise<string> {
  const t = await prisma.team.findUnique({ where: { id: teamId }, select: { name: true } });
  return t?.name ?? "A team";
}
