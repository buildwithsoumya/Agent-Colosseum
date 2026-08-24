-- CreateEnum
CREATE TYPE "Role" AS ENUM ('ADMIN', 'MENTOR', 'PARTICIPANT', 'SPECTATOR');

-- CreateEnum
CREATE TYPE "EventStatus" AS ENUM ('SETUP', 'RUNNING', 'PAUSED', 'ENDED');

-- CreateEnum
CREATE TYPE "Phase" AS ENUM ('PHASE_0', 'PHASE_1', 'PHASE_2', 'PHASE_3', 'PHASE_4', 'PHASE_5');

-- CreateEnum
CREATE TYPE "TaskState" AS ENUM ('LOCKED', 'REVEALED', 'ACTIVE', 'COMPLETED', 'CLOSED');

-- CreateEnum
CREATE TYPE "TaskNumber" AS ENUM ('TASK_1', 'TASK_2');

-- CreateEnum
CREATE TYPE "ProblemStatementStatus" AS ENUM ('DRAFT', 'SUBMITTED', 'UNDER_REVIEW', 'APPROVED', 'REJECTED', 'CHANGES_REQUESTED');

-- CreateEnum
CREATE TYPE "CreditTransactionType" AS ENUM ('STARTING_BALANCE', 'TASK_UNLOCK', 'FEATURE_PURCHASE', 'ARENA_REWARD', 'CASINO_STAKE', 'CASINO_REWARD', 'CASINO_PENALTY', 'ADMIN_ADJUSTMENT', 'SABOTAGE_EFFECT');

-- CreateEnum
CREATE TYPE "FeatureCategory" AS ENUM ('TOOL_MODULE', 'DEFENSIVE_BUFF', 'OFFENSIVE_SABOTAGE');

-- CreateEnum
CREATE TYPE "ArenaRunResult" AS ENUM ('WIN', 'LOSS');

-- CreateEnum
CREATE TYPE "CasinoTier" AS ENUM ('VAULT', 'OVERCLOCK', 'HIGH_ROLLER');

-- CreateEnum
CREATE TYPE "CasinoOutcome" AS ENUM ('PUSH', 'WIN', 'LOSS');

-- CreateEnum
CREATE TYPE "SubmissionStatus" AS ENUM ('OPEN', 'LOCKED', 'EVALUATING', 'EVALUATED');

-- CreateEnum
CREATE TYPE "EvaluationJobState" AS ENUM ('QUEUED', 'PROCESSING', 'COMPLETED', 'FAILED');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "role" "Role" NOT NULL DEFAULT 'PARTICIPANT',
    "trackId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Session" (
    "id" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Session_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Team" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "trackId" TEXT,
    "creditBalance" INTEGER NOT NULL DEFAULT 0,
    "balanceSnapshotAtCasinoClose" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Team_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TeamMember" (
    "teamId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "isCaptain" BOOLEAN NOT NULL DEFAULT false,
    "joinedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TeamMember_pkey" PRIMARY KEY ("teamId","userId")
);

-- CreateTable
CREATE TABLE "Event" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "status" "EventStatus" NOT NULL DEFAULT 'SETUP',
    "currentPhase" "Phase" NOT NULL DEFAULT 'PHASE_0',
    "phaseStartedAt" TIMESTAMP(3),
    "phaseEndsAt" TIMESTAMP(3),
    "pausedAt" TIMESTAMP(3),
    "config" JSONB NOT NULL,
    "startedAt" TIMESTAMP(3),
    "endedAt" TIMESTAMP(3),

    CONSTRAINT "Event_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PhaseRun" (
    "id" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "phase" "Phase" NOT NULL,
    "startedAt" TIMESTAMP(3) NOT NULL,
    "endedAt" TIMESTAMP(3),
    "auto" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "PhaseRun_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Track" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "task1Title" TEXT NOT NULL,
    "task1Body" TEXT NOT NULL,
    "task1Criteria" JSONB NOT NULL,
    "task1UnlockCost" INTEGER NOT NULL DEFAULT 40,
    "task2Title" TEXT NOT NULL,
    "task2Body" TEXT NOT NULL,
    "task2Criteria" JSONB NOT NULL,
    "chaosConditions" JSONB NOT NULL,

    CONSTRAINT "Track_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Task" (
    "id" TEXT NOT NULL,
    "trackId" TEXT NOT NULL,
    "number" "TaskNumber" NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "criteria" JSONB NOT NULL,
    "state" "TaskState" NOT NULL DEFAULT 'LOCKED',
    "revealedAt" TIMESTAMP(3),

    CONSTRAINT "Task_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TaskUnlock" (
    "id" TEXT NOT NULL,
    "teamId" TEXT NOT NULL,
    "taskId" TEXT NOT NULL,
    "costPaid" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TaskUnlock_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProblemStatement" (
    "id" TEXT NOT NULL,
    "teamId" TEXT NOT NULL,
    "trackId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "status" "ProblemStatementStatus" NOT NULL DEFAULT 'DRAFT',
    "mentorNote" TEXT,
    "reviewedById" TEXT,
    "submittedAt" TIMESTAMP(3),
    "reviewedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProblemStatement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CreditTransaction" (
    "id" TEXT NOT NULL,
    "teamId" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,
    "type" "CreditTransactionType" NOT NULL,
    "source" TEXT NOT NULL,
    "reference" TEXT,
    "balanceAfter" INTEGER NOT NULL,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CreditTransaction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Feature" (
    "id" TEXT NOT NULL,
    "trackId" TEXT,
    "category" "FeatureCategory" NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "effect" JSONB NOT NULL,
    "cost" INTEGER NOT NULL,
    "maxPerTeam" INTEGER NOT NULL DEFAULT 1,
    "active" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "Feature_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FeaturePurchase" (
    "id" TEXT NOT NULL,
    "featureId" TEXT NOT NULL,
    "teamId" TEXT NOT NULL,
    "targetTeamId" TEXT,
    "costPaid" INTEGER NOT NULL,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FeaturePurchase_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ArenaGame" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "payoutCc" INTEGER NOT NULL,
    "durationSec" INTEGER NOT NULL DEFAULT 120,
    "active" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "ArenaGame_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ArenaRun" (
    "id" TEXT NOT NULL,
    "teamId" TEXT NOT NULL,
    "gameId" TEXT NOT NULL,
    "playedById" TEXT NOT NULL,
    "result" "ArenaRunResult" NOT NULL,
    "rewardPaid" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ArenaRun_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CasinoBet" (
    "id" TEXT NOT NULL,
    "teamId" TEXT NOT NULL,
    "tier" "CasinoTier" NOT NULL,
    "wagerAmount" INTEGER NOT NULL,
    "outcome" "CasinoOutcome" NOT NULL,
    "preBalance" INTEGER NOT NULL,
    "postBalance" INTEGER NOT NULL,
    "reward" INTEGER NOT NULL,
    "multiplierAwarded" DOUBLE PRECISION NOT NULL DEFAULT 1,
    "perk" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CasinoBet_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Submission" (
    "id" TEXT NOT NULL,
    "teamId" TEXT NOT NULL,
    "repoUrl" TEXT NOT NULL,
    "notes" TEXT,
    "fileKey" TEXT,
    "status" "SubmissionStatus" NOT NULL DEFAULT 'OPEN',
    "lockedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Submission_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EvaluationJob" (
    "id" TEXT NOT NULL,
    "submissionId" TEXT NOT NULL,
    "teamId" TEXT NOT NULL,
    "status" "EvaluationJobState" NOT NULL DEFAULT 'QUEUED',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "error" TEXT,
    "queuedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "startedAt" TIMESTAMP(3),
    "finishedAt" TIMESTAMP(3),

    CONSTRAINT "EvaluationJob_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EvaluationResult" (
    "id" TEXT NOT NULL,
    "jobId" TEXT NOT NULL,
    "teamId" TEXT NOT NULL,
    "accuracyScore" INTEGER NOT NULL,
    "resilienceScore" INTEGER NOT NULL,
    "latencyScore" INTEGER NOT NULL,
    "tokenScore" INTEGER NOT NULL,
    "gauntletScore" INTEGER NOT NULL,
    "payloadsTotal" INTEGER NOT NULL,
    "payloadsPassed" INTEGER NOT NULL,
    "rawMetrics" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EvaluationResult_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GauntletPayload" (
    "id" TEXT NOT NULL,
    "trackId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "prompt" TEXT NOT NULL,
    "passCondition" TEXT NOT NULL,
    "position" INTEGER NOT NULL,

    CONSTRAINT "GauntletPayload_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Score" (
    "id" TEXT NOT NULL,
    "teamId" TEXT NOT NULL,
    "gauntletScore" INTEGER NOT NULL,
    "casinoMultiplier" DOUBLE PRECISION NOT NULL DEFAULT 1,
    "disciplineScore" INTEGER NOT NULL,
    "finalScore" INTEGER NOT NULL,
    "breakdown" JSONB NOT NULL,
    "computedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Score_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LeaderboardEntry" (
    "id" TEXT NOT NULL,
    "teamId" TEXT NOT NULL,
    "rank" INTEGER NOT NULL,
    "gauntletScore" INTEGER NOT NULL DEFAULT 0,
    "casinoMultiplier" DOUBLE PRECISION NOT NULL DEFAULT 1,
    "disciplineScore" INTEGER NOT NULL DEFAULT 0,
    "finalScore" INTEGER NOT NULL DEFAULT 0,
    "creditBalance" INTEGER NOT NULL DEFAULT 0,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LeaderboardEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Announcement" (
    "id" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "level" TEXT NOT NULL DEFAULT 'info',
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Announcement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ActivityEvent" (
    "id" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "summary" TEXT NOT NULL,
    "detail" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ActivityEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AdminAction" (
    "id" TEXT NOT NULL,
    "actorId" TEXT,
    "actorEmail" TEXT,
    "action" TEXT NOT NULL,
    "targetType" TEXT,
    "targetId" TEXT,
    "detail" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AdminAction_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "Session_tokenHash_key" ON "Session"("tokenHash");

-- CreateIndex
CREATE INDEX "Session_userId_idx" ON "Session"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "Team_name_key" ON "Team"("name");

-- CreateIndex
CREATE UNIQUE INDEX "Team_code_key" ON "Team"("code");

-- CreateIndex
CREATE UNIQUE INDEX "TeamMember_userId_key" ON "TeamMember"("userId");

-- CreateIndex
CREATE INDEX "PhaseRun_eventId_idx" ON "PhaseRun"("eventId");

-- CreateIndex
CREATE UNIQUE INDEX "Track_key_key" ON "Track"("key");

-- CreateIndex
CREATE UNIQUE INDEX "Task_trackId_number_key" ON "Task"("trackId", "number");

-- CreateIndex
CREATE UNIQUE INDEX "TaskUnlock_teamId_taskId_key" ON "TaskUnlock"("teamId", "taskId");

-- CreateIndex
CREATE UNIQUE INDEX "ProblemStatement_teamId_key" ON "ProblemStatement"("teamId");

-- CreateIndex
CREATE INDEX "CreditTransaction_teamId_createdAt_idx" ON "CreditTransaction"("teamId", "createdAt");

-- CreateIndex
CREATE INDEX "FeaturePurchase_teamId_idx" ON "FeaturePurchase"("teamId");

-- CreateIndex
CREATE UNIQUE INDEX "ArenaGame_key_key" ON "ArenaGame"("key");

-- CreateIndex
CREATE INDEX "ArenaRun_teamId_idx" ON "ArenaRun"("teamId");

-- CreateIndex
CREATE INDEX "CasinoBet_teamId_idx" ON "CasinoBet"("teamId");

-- CreateIndex
CREATE UNIQUE INDEX "Submission_teamId_key" ON "Submission"("teamId");

-- CreateIndex
CREATE INDEX "EvaluationJob_status_idx" ON "EvaluationJob"("status");

-- CreateIndex
CREATE UNIQUE INDEX "EvaluationResult_jobId_key" ON "EvaluationResult"("jobId");

-- CreateIndex
CREATE INDEX "GauntletPayload_trackId_idx" ON "GauntletPayload"("trackId");

-- CreateIndex
CREATE UNIQUE INDEX "Score_teamId_key" ON "Score"("teamId");

-- CreateIndex
CREATE UNIQUE INDEX "LeaderboardEntry_teamId_key" ON "LeaderboardEntry"("teamId");

-- CreateIndex
CREATE INDEX "LeaderboardEntry_rank_idx" ON "LeaderboardEntry"("rank");

-- CreateIndex
CREATE INDEX "ActivityEvent_createdAt_idx" ON "ActivityEvent"("createdAt");

-- CreateIndex
CREATE INDEX "AdminAction_createdAt_idx" ON "AdminAction"("createdAt");

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_trackId_fkey" FOREIGN KEY ("trackId") REFERENCES "Track"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Session" ADD CONSTRAINT "Session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Team" ADD CONSTRAINT "Team_trackId_fkey" FOREIGN KEY ("trackId") REFERENCES "Track"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TeamMember" ADD CONSTRAINT "TeamMember_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TeamMember" ADD CONSTRAINT "TeamMember_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PhaseRun" ADD CONSTRAINT "PhaseRun_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Task" ADD CONSTRAINT "Task_trackId_fkey" FOREIGN KEY ("trackId") REFERENCES "Track"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TaskUnlock" ADD CONSTRAINT "TaskUnlock_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TaskUnlock" ADD CONSTRAINT "TaskUnlock_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "Task"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProblemStatement" ADD CONSTRAINT "ProblemStatement_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProblemStatement" ADD CONSTRAINT "ProblemStatement_trackId_fkey" FOREIGN KEY ("trackId") REFERENCES "Track"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CreditTransaction" ADD CONSTRAINT "CreditTransaction_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Feature" ADD CONSTRAINT "Feature_trackId_fkey" FOREIGN KEY ("trackId") REFERENCES "Track"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FeaturePurchase" ADD CONSTRAINT "FeaturePurchase_featureId_fkey" FOREIGN KEY ("featureId") REFERENCES "Feature"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FeaturePurchase" ADD CONSTRAINT "FeaturePurchase_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ArenaRun" ADD CONSTRAINT "ArenaRun_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ArenaRun" ADD CONSTRAINT "ArenaRun_gameId_fkey" FOREIGN KEY ("gameId") REFERENCES "ArenaGame"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CasinoBet" ADD CONSTRAINT "CasinoBet_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Submission" ADD CONSTRAINT "Submission_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EvaluationJob" ADD CONSTRAINT "EvaluationJob_submissionId_fkey" FOREIGN KEY ("submissionId") REFERENCES "Submission"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EvaluationResult" ADD CONSTRAINT "EvaluationResult_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "EvaluationJob"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GauntletPayload" ADD CONSTRAINT "GauntletPayload_trackId_fkey" FOREIGN KEY ("trackId") REFERENCES "Track"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Score" ADD CONSTRAINT "Score_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LeaderboardEntry" ADD CONSTRAINT "LeaderboardEntry_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Announcement" ADD CONSTRAINT "Announcement_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event"("id") ON DELETE CASCADE ON UPDATE CASCADE;
