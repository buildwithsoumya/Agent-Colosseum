# Architecture

## Principles

1. **Backend is the source of truth.** Phases, timers, credit balances, casino outcomes, scores and permissions are decided exclusively server-side. The browser is a rendering surface.
2. **The database is durable state.** Prisma/PostgreSQL models in `backend/prisma/schema.prisma`. Every important transition leaves an auditable row (ledger entries, phase runs, admin actions).
3. **Redis coordinates realtime and async work.** BullMQ queues Gauntlet jobs; Redis pubsub (`realtime` channel) carries socket payloads from any service (backend modules or the evaluator worker) to connected clients.
4. **The evaluator owns final agent testing.** Clean seams (`Evaluator`, `EvaluationJob`, `EvaluationResult`, `TestCase`, `MetricResult` in `evaluator/src/types.ts`) let a real Docker execution layer replace the simulated one without redesigning anything.

## Package layout

```
frontend/   Next.js App Router. Public site + participant app + mentor/admin/spectator.
backend/
  src/config/env.ts        zod-validated environment
  src/lib/                 prisma, redis (cmd+pubsub), logger, rng, queue, monitor hook
  src/middleware/          authOptional/requireAuth/requireRole/loadMembership,
                           zod validate, rate limiters, error handler + asyncHandler
  src/services/            business rules:
                           eventEngine   phase state machine + heartbeat + gates
                           credits       atomic ledger gateway (only path to balances)
                           casino        outcome drawing, bust protection
                           scoring       PRD formulas (pure math lives in @ac/shared)
                           leaderboard   rank recompute + broadcast
                           gauntlet      submission lock → queue → finalize scoring
                           storage       local disk / S3 seam
                           audit         append-only AdminAction log
                           activity      spectator feed rows
  src/modules/*.routes.ts  thin Express routers per domain
  src/realtime/gateway.ts  Socket.IO server + redis pubsub fan-out
evaluator/
  src/worker.ts            BullMQ consumer; loads track payloads, team purchases,
                           casino perks; runs Evaluator; persists EvaluationResult;
                           publishes progress + internal completion message
  src/evaluators/simulated deterministic demo evaluation influenced by real state
  src/evaluators/docker    documented not-implemented seam for container runs
shared/                    zod schemas, PHASE_META, GameConfig defaults, socket event
                           names, pure scoring math (computeGauntletScore)
```

## Key data flows

### Credit mutation (single gateway)

```
route handler
  → prisma.$transaction(SERIALIZABLE)
      SELECT ... FOR UPDATE on Team row
      balance check / integer check
      UPDATE team.creditBalance
      INSERT CreditTransaction(balanceAfter)
  → announceBalance() → socket credits:updated to team room
```

Nothing else may write `creditBalance`. The ledger is append-only; cached balance equals ledger truth (enforced by tests).

### Event engine

`Event` singleton holds current phase/status/timestamps. `startHeartbeat()` ticks every second: emits `timer:updated`, auto-advances at zero (creating PhaseRun history). Phase transitions apply side effects (task reveals, discipline snapshot at P4 entry, task closure at P5) inside a DB transaction, then broadcast `phase:changed`. Derived **gates** (`computeGates`) drive every route-level permission for store/arena/casino/submissions.

### Gauntlet pipeline

```
POST /api/submissions/me/lock   (phase gate, repo required, OPEN status)
  → Submission LOCKED/EVALUATING, EvaluationJob PROCESSING
  → BullMQ queue "gauntlet"
evaluator worker
  → loads payloads + defensive buffs owned + sabotage targeted + casino perks
  → SimulatedEvaluator.evaluate (seeded RNG, capped sabotage influence)
  → writes EvaluationResult, publishes gauntlet:progress events
  → redis publish internal {type:"evaluation.completed", jobId}
backend finalizeEvaluation(jobId)
  → ScoringService breakdown (gauntlet × casino mult + discipline)
  → Score upsert → leaderboard recompute → leaderboard:updated broadcast
```

### Realtime rooms

- global room `event` — phases, timer, leaderboard, announcements, activity
- `team:<id>` — credits, personal results (arena/casino/submission)
- `role:admins` / `role:mentors` — operational fan-out when needed

Socket auth resolves the same session cookie as HTTP; anonymous sockets only join the public event room.

## Security model

- Sessions: opaque random tokens, stored hashed (SHA-256), httpOnly SameSite=Lax cookies, TTL from env.
- RBAC middleware (`requireRole`) guards admin/mentor routes; captain checks read server-side membership.
- Zod validation on every mutating route body; params guarded under `noUncheckedIndexedAccess`.
- Rate limiting: strict on auth (30/15min), action limiter on gameplay mutations (60/min), generous reads.
- Casino outcomes use `crypto.randomBytes`; arena results likewise; both recorded with pre/post balances.
- Bust protection enforced inside the casino transaction, never in UI.
- Sabotage impact capped (review recommendation); evaluator caps lag penalties by construction.
- Error monitoring hook (`captureException`) is sink-agnostic; wire Sentry via `SENTRY_DSN`.

## Design system

White background, near-black ink, violet accent used sparingly (`--color-accent #6d28d9`), thin neutral borders, restrained shadows, tabular numerals for data, Framer Motion limited to meaningful transitions (leaderboard movement, credit changes, modals, phase swaps). Spectator display is dark for projector contrast; everything else stays light.
