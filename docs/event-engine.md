# Event Engine

The server-controlled state machine that runs Agent Colosseum. Implemented in `backend/src/services/eventEngine.ts`.

## Phases (PRD §2)

| Phase | Label | Default | Opens |
|-------|-------|---------|-------|
| PHASE_0 | Onboarding & Briefing | 15 min | track select, problem statements |
| PHASE_1 | Task 1: Integration | 45 min | task unlock, Feature Store, Game Arena |
| PHASE_2 | Task 2: Orchestration & Chaos | 60 min | Task 2 reveal, store + arena stay open |
| PHASE_3 | Casino Royale | 20 min | casino only — code "paused" (store/arena close) |
| PHASE_4 | Colosseum Gauntlet | 45 min | submissions; evaluation pipeline |
| PHASE_5 | Podium & Wrap-Up | 25 min | read-only, tasks closed |

Durations are defaults from `PHASE_META` (`@ac/shared`); admins advance manually at any time.

## State

```
Event {
  status: SETUP → RUNNING ⇄ PAUSED → ENDED
  currentPhase, phaseStartedAt, phaseEndsAt, pausedAt
}
PhaseRun { phase, startedAt, endedAt, auto }   // immutable transition history
```

- The browser never computes truth. Clients render `phaseEndsAt` and interpolate; the backend heartbeat (1s) publishes `timer:updated` and **auto-advances** phases when time expires.
- Pause freezes remaining time by shifting `phaseEndsAt` on resume — no drift, no client trust.
- `PhaseRun` rows record every transition including whether it was automatic or admin-triggered.

## Derived gates

Single source of truth for what teams can do:

```ts
computeGates(phase) => {
  psApprovalOpen:   phase === PHASE_0
  taskUnlockOpen:   phase === PHASE_1
  storeOpen:        phase ∈ {PHASE_1, PHASE_2}     // PRD §4
  arenaOpen:        phase ∈ {PHASE_1, PHASE_2}     // PRD §5
  casinoOpen:       phase === PHASE_3              // PRD §6
  submissionsOpen:  phase === PHASE_4              // PRD §7
}
```

Every gameplay route checks its gate server-side before touching state.

## Phase side effects

On entering a phase (inside one DB transaction):

- **PHASE_0** — issue opening balances (1,000 CC) to all teams without one; also issued lazily on team creation mid-event.
- **PHASE_1** — reveal TASK_1 across tracks (`LOCKED → REVEALED`).
- **PHASE_2** — mark TASK_1 `COMPLETED`, reveal TASK_2.
- **PHASE_4** — snapshot each team's balance as `balanceSnapshotAtCasinoClose` (the B for credit discipline; PRD says end of Casino Royale).
- **PHASE_5** — close all tasks; event becomes ENDED.

Manual admin reveals (`POST /api/admin/tasks/reveal`) can fire earlier than the phase trigger.

## Admin controls

All logged to the AdminAction audit trail:

start · pause · resume · advance · reset-demo (dev only) · reveal Task 1/2 · broadcast announcements · credit adjustments with mandatory reason.

## Scoring hooks

- Leaving Casino Royale captures B (discipline input).
- Evaluation completion triggers `ScoringService` via the internal Redis channel; results land in `Score` + `LeaderboardEntry`, then broadcast.
