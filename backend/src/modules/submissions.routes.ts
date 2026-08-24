import { Router } from "express";
import { z } from "zod";
import multer from "multer";
import { conflict, unprocessable } from "../lib/errors.js";
import { prisma } from "../lib/prisma.js";
import { requireTeam } from "../middleware/auth.js";
import { validate } from "../middleware/validate.js";
import { actionLimiter } from "../middleware/rateLimit.js";
import { asyncHandler } from "../middleware/errorHandler.js";
import { storage } from "../services/storage.js";
import {
  gauntletStatusForTeam,
  lockSubmissionAndEnqueue,
} from "../services/gauntlet.js";
import { computeGates, getEvent, snapshot } from "../services/eventEngine.js";

export const submissionsRouter = Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 20 * 1024 * 1024 } });

const RepoUrl = z
  .string()
  .url()
  .max(500)
  .refine((u) => /^https?:\/\//.test(u), "Must be an http(s) URL");

/** Current submission + evaluation state for the caller's team. */
submissionsRouter.get(
  "/me",
  requireTeam,
  asyncHandler(async (req, res) => {
    const snap = await snapshot();
    const status = await gauntletStatusForTeam(req.membership!.teamId);
    res.json({ gates: snap.gates, ...status });
  }),
);

/** Create/update the submission while still OPEN (PRD: repo or drive link). */
submissionsRouter.put(
  "/me",
  actionLimiter,
  requireTeam,
  validate(z.object({ repoUrl: RepoUrl, notes: z.string().max(2000).optional() })),
  asyncHandler(async (req, res) => {
    await assertSubmissionsOpen();
    const teamId = req.membership!.teamId;
    const existing = await prisma.submission.findUnique({ where: { teamId } });
    if (existing && existing.status !== "OPEN") throw conflict("Submission is locked and can no longer be edited");

    const submission = existing
      ? await prisma.submission.update({
          where: { id: existing.id },
          data: { repoUrl: (req.body as { repoUrl: string }).repoUrl },
        })
      : await prisma.submission.create({
          data: { teamId, repoUrl: (req.body as { repoUrl: string }).repoUrl },
        });
    res.json({ submission });
  }),
);

/** Optional artefact upload through the storage abstraction (local disk in dev). */
submissionsRouter.post(
  "/me/file",
  actionLimiter,
  requireTeam,
  upload.single("file"),
  asyncHandler(async (req, res) => {
    await assertSubmissionsOpen();
    if (!req.file) throw unprocessable("Attach a file under 'file'");
    const stored = await storage.put(req.file.buffer, req.file.originalname, req.file.mimetype);
    const teamId = req.membership!.teamId;
    await prisma.submission.upsert({
      where: { teamId },
      create: { teamId, repoUrl: "pending://upload", fileKey: stored.key },
      update: { fileKey: stored.key },
    });
    res.status(201).json({ fileKey: stored.key });
  }),
);

/** Lock entry → queue Gauntlet evaluation. Irreversible. */
submissionsRouter.post(
  "/me/lock",
  actionLimiter,
  requireTeam,
  asyncHandler(async (req, res) => {
    const job = await lockSubmissionAndEnqueue(req.membership!.teamId);
    res.status(202).json({ jobId: job.id });
  }),
);

async function assertSubmissionsOpen(): Promise<void> {
  const event = await getEvent();
  if (!computeGates(event.currentPhase).submissionsOpen) {
    throw unprocessable("Submissions are only open during PHASE_4");
  }
}
