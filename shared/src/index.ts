import { z } from "zod";

/* ---------------------------------- roles --------------------------------- */

/** Global application roles — assigned ONLY by the server (seed, admin provisioning, invitations). */
export const GlobalRole = z.enum(["ADMIN", "MENTOR", "PARTICIPANT"]);
export type GlobalRole = z.infer<typeof GlobalRole>;

/** Team-level roles — scoped to a single team membership. */
export const TeamRole = z.enum(["MEMBER", "CAPTAIN"]);
export type TeamRole = z.infer<typeof TeamRole>;

/** Account status — SUSPENDED users fail all authentication. */
export const UserStatus = z.enum(["ACTIVE", "SUSPENDED"]);
export type UserStatus = z.infer<typeof UserStatus>;

/* ---------------------------------- phases -------------------------------- */

export const Phase = z.enum([
  "PHASE_0",
  "PHASE_1",
  "PHASE_2",
  "PHASE_3",
  "PHASE_4",
  "PHASE_5",
]);
export type Phase = z.infer<typeof Phase>;

export const PHASE_ORDER: Phase[] = [
  "PHASE_0",
  "PHASE_1",
  "PHASE_2",
  "PHASE_3",
  "PHASE_4",
  "PHASE_5",
];

export const PHASE_META: Record<Phase, { label: string; short: string; defaultMinutes: number; objective: string }> = {
  PHASE_0: {
    label: "Onboarding & Briefing",
    short: "Onboarding",
    defaultMinutes: 15,
    objective: "Log in, form your team, pick a track and submit your problem statement for approval.",
  },
  PHASE_1: {
    label: "Task 1: Integration",
    short: "Integration",
    defaultMinutes: 45,
    objective: "Task 1 is live. Unlock it, buy Feature Store components and wire up your integrations.",
  },
  PHASE_2: {
    label: "Task 2: Orchestration & Chaos",
    short: "Orchestration",
    defaultMinutes: 60,
    objective: "Build multi-step orchestration over Task 1 while surviving schema drift and corrupt inputs.",
  },
  PHASE_3: {
    label: "Casino Royale",
    short: "Casino Royale",
    defaultMinutes: 20,
    objective: "Hands off code. Wager remaining credits on the Vault, the Overclock or the High-Roller.",
  },
  PHASE_4: {
    label: "Colosseum Gauntlet",
    short: "Gauntlet",
    defaultMinutes: 45,
    objective: "Submit your final repo and lock entry. The zero-touch Gauntlet bombards agents on stage.",
  },
  PHASE_5: {
    label: "Podium & Wrap-Up",
    short: "Podium",
    defaultMinutes: 25,
    objective: "Final scores are in. Winners take the podium.",
  },
};

export const EventStatus = z.enum(["SETUP", "RUNNING", "PAUSED", "ENDED"]);
export type EventStatus = z.infer<typeof EventStatus>;

/* ------------------------------- problem statements ------------------------ */

export const ProblemStatementStatus = z.enum([
  "DRAFT",
  "SUBMITTED",
  "UNDER_REVIEW",
  "APPROVED",
  "REJECTED",
  "CHANGES_REQUESTED",
]);
export type ProblemStatementStatus = z.infer<typeof ProblemStatementStatus>;

/* ------------------------------------ tasks -------------------------------- */

export const TaskNumber = z.enum(["TASK_1", "TASK_2"]);
export type TaskNumber = z.infer<typeof TaskNumber>;

export const TaskState = z.enum(["LOCKED", "REVEALED", "ACTIVE", "COMPLETED", "CLOSED"]);
export type TaskState = z.infer<typeof TaskState>;

/* ------------------------------------ credits ------------------------------ */

export const CreditTransactionType = z.enum([
  "STARTING_BALANCE",
  "TASK_UNLOCK",
  "FEATURE_PURCHASE",
  "ARENA_REWARD",
  "CASINO_STAKE",
  "CASINO_REWARD",
  "CASINO_PENALTY",
  "ADMIN_ADJUSTMENT",
  "SABOTAGE_EFFECT",
]);
export type CreditTransactionType = z.infer<typeof CreditTransactionType>;

/* ------------------------------------ store -------------------------------- */

export const FeatureCategory = z.enum(["TOOL_MODULE", "DEFENSIVE_BUFF", "OFFENSIVE_SABOTAGE"]);
export type FeatureCategory = z.infer<typeof FeatureCategory>;

export const FEATURE_CATEGORY_LABEL: Record<FeatureCategory, string> = {
  TOOL_MODULE: "Tool Modules",
  DEFENSIVE_BUFF: "Defensive Buffs",
  OFFENSIVE_SABOTAGE: "Offensive Sabotage",
};

/* ------------------------------------ arena -------------------------------- */

export const ArenaRunResult = z.enum(["WIN", "LOSS"]);
export type ArenaRunResult = z.infer<typeof ArenaRunResult>;

/* ------------------------------------ casino ------------------------------- */

export const CasinoTier = z.enum(["VAULT", "OVERCLOCK", "HIGH_ROLLER"]);
export type CasinoTier = z.infer<typeof CasinoTier>;

export const CasinoOutcome = z.enum(["PUSH", "WIN", "LOSS"]);
export type CasinoOutcome = z.infer<typeof CasinoOutcome>;

/** Tunable economy/casino/scoring knobs. PRD values; PRD marks figures as configurable. */
export const GameConfigSchema = z.object({
  openingBalanceCc: z.number().int().default(1000),
  taskUnlockCostCc: z.number().int().default(40),
  arenaMaxRunsPerTeam: z.number().int().default(4),
  arenaPayoutCc: z.number().int().default(150),
  casinoOverclockWagerCc: z.number().int().default(200),
  casinoOverclockWinChance: z.number().min(0).max(1).default(0.5),
  casinoHighRollerStakeFraction: z.number().min(0).max(1).default(0.35),
  casinoHighRollerWinChance: z.number().min(0).max(1).default(0.3),
  casinoHighRollerMultiplier: z.number().default(2.5),
  bustProtectionFloorCc: z.number().int().default(300),
  disciplineThresholdCc: z.number().int().default(100),
  disciplineStartCc: z.number().int().default(1000),
  disciplineCapPoints: z.number().int().default(150),
  gauntletWeights: z
    .object({
      accuracy: z.number().default(0.4),
      resilience: z.number().default(0.25),
      latency: z.number().default(0.2),
      tokens: z.number().default(0.15),
    })
    .default({ accuracy: 0.4, resilience: 0.25, latency: 0.2, tokens: 0.15 }),
});
export type GameConfig = z.infer<typeof GameConfigSchema>;

export const DEFAULT_GAME_CONFIG: GameConfig = GameConfigSchema.parse({});

/* ----------------------------------- submissions --------------------------- */

export const SubmissionStatus = z.enum(["OPEN", "LOCKED", "EVALUATING", "EVALUATED"]);
export type SubmissionStatus = z.infer<typeof SubmissionStatus>;

export const EvaluationJobStatus = z.enum(["QUEUED", "PROCESSING", "COMPLETED", "FAILED"]);
export type EvaluationJobStatus = z.infer<typeof EvaluationJobStatus>;

/* ------------------------------------ socket events ------------------------ */

export const SocketEvent = {
  PhaseChanged: "phase:changed",
  TimerUpdated: "timer:updated",
  TaskRevealed: "task:revealed",
  CreditsUpdated: "credits:updated",
  StorePurchase: "store:purchase",
  ArenaResult: "arena:result",
  CasinoResult: "casino:result",
  LeaderboardUpdated: "leaderboard:updated",
  SubmissionUpdated: "submission:updated",
  GauntletProgress: "gauntlet:progress",
  GauntletCompleted: "gauntlet:completed",
  AnnouncementNew: "announcement:new",
  ActivityNew: "activity:new",
} as const;
export type SocketEventName = (typeof SocketEvent)[keyof typeof SocketEvent];

export * from "./scoring.js";

/* ---------------------------------- API envelope --------------------------- */

export interface ApiError {
  error: string;
  details?: unknown;
}

/* -------------------------------- auth payloads ---------------------------- */

export const RegisterInput = z.object({
  name: z.string().min(2).max(80),
  email: z.string().email(),
  password: z.string().min(8).max(128),
});
export type RegisterInput = z.infer<typeof RegisterInput>;

export const LoginInput = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});
export type LoginInput = z.infer<typeof LoginInput>;

export interface PublicUser {
  id: string;
  email: string;
  name: string;
  globalRole: GlobalRole;
}

/* ------------------------------ invitations ------------------------------- */

/** Roles that may ever be granted through an invitation. ADMIN is deliberately excluded. */
export const InvitableRole = z.enum(["MENTOR", "CAPTAIN"]);
export type InvitableRole = z.infer<typeof InvitableRole>;

export const InvitationAcceptInput = z.object({
  token: z.string().min(20).max(200),
  name: z.string().min(2).max(80),
  password: z.string().min(8).max(128),
});
export type InvitationAcceptInputType = z.infer<typeof InvitationAcceptInput>;
