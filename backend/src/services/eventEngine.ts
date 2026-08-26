import { SocketEvent, PHASE_META, PHASE_ORDER, type GameConfig, type Phase } from "@ac/shared";
import type { Event as EventModel } from "@prisma/client";
import { GameConfigSchema } from "@ac/shared";
import { badRequest, conflict } from "../lib/errors.js";
import { prisma } from "../lib/prisma.js";
import { publish } from "../realtime/gateway.js";
import { logAdminAction } from "./audit.js";
import { recordActivity } from "./activity.js";
import { applyLedgerEntry } from "./credits.js";

export type EventRow = EventModel;

/** The singleton event. Demo ships with exactly one running event. */
export async function getEvent() {
  const event = await prisma.event.findFirst({ orderBy: { id: "asc" } });
  if (!event) throw badRequest("Event not initialised — run the seed first");
  return event;
}

export function eventConfig(event: EventRow): GameConfig {
  return GameConfigSchema.parse(event.config);
}

export interface PhaseSnapshot {
  phase: Phase;
  phaseLabel: string;
  objective: string;
  status: "SETUP" | "RUNNING" | "PAUSED" | "ENDED";
  phaseStartedAt: string | null;
  phaseEndsAt: string | null;
  pausedAt: string | null;
  serverTime: string;
  secondsRemaining: number;
  gates: Gates;
}

export interface Gates {
  teamCreateOpen: boolean;
  teamJoinOpen: boolean;
  psApprovalOpen: boolean;
  taskUnlockOpen: boolean;
  storeOpen: boolean;
  arenaOpen: boolean;
  casinoOpen: boolean;
  submissionsOpen: boolean;
}

/**
 * Derived gameplay gates. Single source of truth for "what can teams do now".
 * PRD: store+arena live P1–P2, casino P3 (code paused), submissions P4.
 */
export function computeGates(phase: Phase, config?: GameConfig): Gates {
  // Team formation runs from SETUP until the configured last phase (PRD: onboarding).
  const lastTeamPhase = config?.teamJoinLastPhase ?? "PHASE_0";
  const teamOpen =
    phase === "PHASE_0" ? true : lastTeamPhase !== "SETUP" && PHASE_ORDER.indexOf(phase) <= PHASE_ORDER.indexOf(lastTeamPhase);
  return {
    teamCreateOpen: teamOpen,
    teamJoinOpen: teamOpen,
    psApprovalOpen: phase === "PHASE_0",
    taskUnlockOpen: phase === "PHASE_1",
    storeOpen: phase === "PHASE_1" || phase === "PHASE_2",
    arenaOpen: phase === "PHASE_1" || phase === "PHASE_2",
    casinoOpen: phase === "PHASE_3",
    submissionsOpen: phase === "PHASE_4",
  };
}

export async function snapshot(): Promise<PhaseSnapshot> {
  const event = await getEvent();
  return { ...rowToSnapshot(event), gates: computeGates(event.currentPhase) };
}

function rowToSnapshot(event: EventRow): Omit<PhaseSnapshot, "gates"> {
  const secondsRemaining =
    event.status === "RUNNING" && event.phaseEndsAt
      ? Math.max(0, Math.floor((event.phaseEndsAt.getTime() - Date.now()) / 1000))
      : 0;
  return {
    phase: event.currentPhase,
    phaseLabel: PHASE_META[event.currentPhase].label,
    objective: PHASE_META[event.currentPhase].objective,
    status: event.status,
    phaseStartedAt: event.phaseStartedAt?.toISOString() ?? null,
    phaseEndsAt: event.phaseEndsAt?.toISOString() ?? null,
    pausedAt: event.pausedAt?.toISOString() ?? null,
    serverTime: new Date().toISOString(),
    secondsRemaining,
  };
}

/* ------------------------------------------------------------------ controls */

async function issueStartingBalances(): Promise<void> {
  const config = await getEvent().then(eventConfig);
  const teams = await prisma.team.findMany({ select: { id: true } });
  for (const team of teams) {
    const existing = await prisma.creditTransaction.findFirst({
      where: { teamId: team.id, type: "STARTING_BALANCE" },
    });
    if (!existing) {
      await prisma.$transaction((tx) =>
        applyLedgerEntry(tx, team.id, {
          amount: config.openingBalanceCc,
          type: "STARTING_BALANCE",
          source: "Event opening balance",
        }),
      );
    }
  }
}

async function beginPhase(eventId: string, phase: Phase, auto: boolean): Promise<void> {
  const event = await getEvent();
  const minutes = PHASE_META[phase].defaultMinutes;
  const now = new Date();
  const endsAt = new Date(now.getTime() + minutes * 60_000);

  await prisma.$transaction(async (tx) => {
    // close previous phase run
    const openRun = await tx.phaseRun.findFirst({
      where: { eventId, endedAt: null },
      orderBy: { startedAt: "desc" },
    });
    if (openRun) {
      await tx.phaseRun.update({ where: { id: openRun.id }, data: { endedAt: now, auto } });
    }
    await tx.phaseRun.create({ data: { eventId, phase, startedAt: now } });
    await tx.event.update({
      where: { id: eventId },
      data: {
        currentPhase: phase,
        status: phase === "PHASE_5" ? "ENDED" : "RUNNING",
        phaseStartedAt: now,
        phaseEndsAt: endsAt,
        pausedAt: null,
        startedAt: event.startedAt ?? now,
        endedAt: phase === "PHASE_5" ? (event.endedAt ?? endsAt) : event.endedAt,
      },
    });

    // ---- phase side effects -------------------------------------------------
    if (phase === "PHASE_1") {
      await tx.task.updateMany({ where: { number: "TASK_1", state: "LOCKED" }, data: { state: "REVEALED", revealedAt: now } });
    }
    if (phase === "PHASE_2") {
      await tx.task.updateMany({ where: { number: "TASK_1" }, data: { state: "COMPLETED" } });
      await tx.task.updateMany({ where: { number: "TASK_2", state: "LOCKED" }, data: { state: "REVEALED", revealedAt: now } });
    }
    if (phase === "PHASE_4") {
      // B for credit discipline is the balance at the END of Casino Royale.
      const teams = await tx.team.findMany({ select: { id: true, creditBalance: true } });
      for (const t of teams) {
        await tx.team.update({ where: { id: t.id }, data: { balanceSnapshotAtCasinoClose: t.creditBalance } });
      }
    }
    if (phase === "PHASE_5") {
      await tx.task.updateMany({ data: { state: "CLOSED" } });
    }
  });

  // opening balance lands when the event actually starts
  if (phase === "PHASE_0") await issueStartingBalances();

  const snap = await snapshot();
  publish(SocketEvent.PhaseChanged, snap);
  publish(SocketEvent.TimerUpdated, timerPayload(snap));
  if (phase === "PHASE_1" || phase === "PHASE_2") {
    publish(SocketEvent.TaskRevealed, { taskNumber: phase === "PHASE_1" ? "TASK_1" : "TASK_2", at: now.toISOString() });
  }
  await recordActivity("PHASE", `${PHASE_META[phase].label} started`, { phase, auto });
  void logAdminAction(undefined, auto ? "event.auto_advance" : "event.begin_phase", "event", eventId, { phase });
}

export async function startEvent(actorId?: string): Promise<PhaseSnapshot> {
  const event = await getEvent();
  if (event.status !== "SETUP") throw conflict("Event already started");
  await beginPhase(event.id, "PHASE_0", false);
  await logAdminAction(actorId, "event.start", "event", event.id);
  await recordActivity("ANNOUNCEMENT", "Agent Colosseum is live!");
  return snapshot();
}

export async function advancePhase(actorId?: string, auto = false): Promise<PhaseSnapshot> {
  const event = await getEvent();
  if (event.status === "SETUP") throw conflict("Start the event first");
  const idx = PHASE_ORDER.indexOf(event.currentPhase);
  const next = PHASE_ORDER[idx + 1];
  if (!next) throw conflict("Already in the final phase");
  await beginPhase(event.id, next, auto);
  return snapshot();
}

export async function pauseEvent(actorId?: string): Promise<PhaseSnapshot> {
  const event = await getEvent();
  if (event.status !== "RUNNING") throw conflict("Only a running phase can be paused");
  if (event.currentPhase === "PHASE_5") throw conflict("Podium cannot be paused");
  await prisma.event.update({ where: { id: event.id }, data: { status: "PAUSED", pausedAt: new Date() } });
  await logAdminAction(actorId, "event.pause", "event", event.id);
  return snapshot();
}

export async function resumeEvent(actorId?: string): Promise<PhaseSnapshot> {
  const event = await getEvent();
  if (event.status !== "PAUSED" || !event.pausedAt) throw conflict("Event is not paused");
  const pausedForMs = Date.now() - event.pausedAt.getTime();
  const newEnds = event.phaseEndsAt ? new Date(event.phaseEndsAt.getTime() + pausedForMs) : null;
  await prisma.event.update({
    where: { id: event.id },
    data: { status: "RUNNING", pausedAt: null, phaseEndsAt: newEnds },
  });
  await logAdminAction(actorId, "event.resume", "event", event.id, { pausedForMs });
  return snapshot();
}

/** Manual timed reveal (admin override before/with phase). */
export async function revealTask(number: "TASK_1" | "TASK_2", actorId?: string) {
  const result = await prisma.task.updateMany({
    where: { number, state: "LOCKED" },
    data: { state: "REVEALED", revealedAt: new Date() },
  });
  if (result.count > 0) {
    publish(SocketEvent.TaskRevealed, { taskNumber: number, at: new Date().toISOString() });
  }
  await logAdminAction(actorId, `task.reveal.${number}`, "task", number);
  return { revealed: result.count };
}

export async function announce(message: string, level: "info" | "success" | "warning", actorId?: string) {
  const event = await getEvent();
  const row = await prisma.announcement.create({
    data: { eventId: event.id, message, level, createdById: actorId },
  });
  const payload = { id: row.id, message, level, createdAt: row.createdAt.toISOString() };
  publish(SocketEvent.AnnouncementNew, payload);
  await recordActivity("ANNOUNCEMENT", message, { level });
  await logAdminAction(actorId, "announcement.broadcast", "announcement", row.id, { level });
  return payload;
}

export interface TimerPayload {
  phase: Phase;
  secondsRemaining: number;
  endsAt: string | null;
  paused: boolean;
  serverTime: string;
}

export function timerPayload(snap: PhaseSnapshot): TimerPayload {
  return {
    phase: snap.phase,
    secondsRemaining: snap.secondsRemaining,
    endsAt: snap.phaseEndsAt,
    paused: snap.status === "PAUSED",
    serverTime: snap.serverTime,
  };
}

/** Auto-advance heartbeat. Started from server bootstrap; safe to call repeatedly. */
let heartbeat: NodeJS.Timeout | null = null;
export function startHeartbeat(): void {
  if (heartbeat) return;
  let advancing = false;
  heartbeat = setInterval(() => {
    void (async () => {
      try {
        const event = await prisma.event.findFirst();
        if (!event) return;
        const snap = rowToSnapshot(event);
        if (event.status === "RUNNING" && snap.secondsRemaining <= 0) {
          if (advancing) return;
          advancing = true;
          try {
            await advancePhase(undefined, true);
          } finally {
            advancing = false;
          }
          return;
        }
        publish(SocketEvent.TimerUpdated, timerPayload({ ...snap, gates: computeGates(event.currentPhase) }));
      } catch {
        // heartbeat must never crash the process
      }
    })();
  }, 1000);
  heartbeat.unref();
}

/** Dev/demo-only reset of runtime state while preserving users, teams and catalogue. */
export async function resetDemoState(actorId?: string): Promise<void> {
  await prisma.leaderboardEntry.deleteMany();
  await prisma.score.deleteMany();
  await prisma.evaluationResult.deleteMany();
  await prisma.evaluationJob.deleteMany();
  await prisma.submission.deleteMany();
  await prisma.casinoBet.deleteMany();
  await prisma.arenaRun.deleteMany();
  await prisma.featurePurchase.deleteMany();
  await prisma.creditTransaction.deleteMany();
  await prisma.taskUnlock.deleteMany();
  await prisma.problemStatement.deleteMany();
  await prisma.activityEvent.deleteMany();
  await prisma.announcement.deleteMany();
  await prisma.phaseRun.deleteMany();
  await prisma.task.updateMany({ data: { state: "LOCKED", revealedAt: null } });
  const event = await getEvent();
  await prisma.event.update({
    where: { id: event.id },
    data: {
      status: "SETUP",
      currentPhase: "PHASE_0",
      phaseStartedAt: null,
      phaseEndsAt: null,
      pausedAt: null,
      startedAt: null,
      endedAt: null,
    },
  });
  await prisma.team.updateMany({ data: { creditBalance: 0, balanceSnapshotAtCasinoClose: null } });
  await logAdminAction(actorId, "event.reset_demo", "event", event.id);
}
