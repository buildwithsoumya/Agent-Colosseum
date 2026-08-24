# Agent Colosseum — Requirements Extraction

Source of truth: `docs/Agent_Colosseum_PRD_v2.pdf` (PRD v2).
Secondary guidance: `docs/Agent_Colosseum_PRD_Review_and_Recommendations.docx`.

Requirement tags:

- `[FIXED]` — explicitly decided by the PRD. Implement as specified.
- `[CONFIG]` — PRD marks the value as illustrative / pending / open decision. Implement as configurable data (seeded defaults), never hardcode.
- `[REC]` — from the review/recommendations document (design guidance, not PRD law).

---

## 1. Event Engine

| ID | Requirement | Tag |
|----|-------------|-----|
| EE-1 | Six sequential phases: PHASE_0 Onboarding & Briefing (15m), PHASE_1 Task 1 Integration (45m), PHASE_2 Task 2 Orchestration & Chaos (60m), PHASE_3 Casino Royale (20m), PHASE_4 Colosseum Gauntlet (45m), PHASE_5 Podium & Wrap-Up (25m). Total 3h30m. | `[FIXED]` |
| EE-2 | Phase durations are configurable defaults; admin can advance phases manually before timer expiry. | `[FIXED]` |
| EE-3 | The backend/database is the sole source of truth for current phase, start/end time, paused state and reveal state. Browser clock is never trusted. | `[FIXED]` |
| EE-4 | Admin controls: start phase, pause/resume (where supported), manual advance, reveal tasks, broadcast announcements, reset event in demo/dev mode. | `[FIXED]` |
| EE-5 | Task 1 reveals in PHASE_1 ("10:00 AM" in PRD narrative = phase-start trigger). Task 2 reveals at PHASE_2 start. Reveal can be timed or manual. | `[FIXED]` |
| EE-6 | PHASE_3 pauses coding: store/arena close, casino opens. | `[FIXED]` |
| EE-7 | All admin phase actions are written to an audit log. | `[FIXED]` |

## 2. Authentication & Roles

| ID | Requirement | Tag |
|----|-------------|-----|
| AU-1 | Login/logout/session persistence via secure httpOnly cookies. | `[FIXED]` |
| AU-2 | Roles: Participant, Team Captain, Mentor, Admin, Spectator. Captain is a team-membership property (`isCaptain`) on top of the Participant role. | `[FIXED]` |
| AU-3 | Role information from the browser is never trusted; authorization enforced server-side per route. | `[FIXED]` |
| AU-4 | Protected routes for participant app, mentor dashboard, admin portal. Spectator view is public read-only. | `[FIXED]` |

## 3. Teams

| ID | Requirement | Tag |
|----|-------------|-----|
| TM-1 | Team creation assigns creator as captain; join via team code/invite code. | `[FIXED]` |
| TM-2 | Team has name, track selection (captain-only change while in PHASE_0), member list, status. | `[FIXED]` |
| TM-3 | One shared credit balance, submission, arena run pool and casino bet per team. | `[FIXED]` |

## 4. Tracks

| ID | Requirement | Tag |
|----|-------------|-----|
| TR-1 | Configurable tracks; demo seeds FinTech, CyberSec, Logistics/HealthTech, Custom/Open. | `[FIXED]` structure, `[CONFIG]` content |
| TR-2 | Track config holds: name, description, Task 1 wording, Task 2 wording + chaos conditions, acceptance criteria, verification tests, Gauntlet payloads, Feature Store items with costs. | `[FIXED]` structure, `[CONFIG]` values |
| TR-3 | Track owners submit task wording per PRD §3 volunteer template — all currently pending → seeded demo content marked illustrative. | `[CONFIG]` |

## 5. Problem Statements

| ID | Requirement | Tag |
|----|-------------|-----|
| PS-1 | Participants write their own problem statement inside their chosen track during PHASE_0. | `[FIXED]` |
| PS-2 | Mentors approve against 3 criteria: inside track domain, achievable by an agent in event duration, addressable by both generic tasks. | `[FIXED]` |
| PS-3 | Statuses server-controlled: DRAFT → SUBMITTED → UNDER_REVIEW → APPROVED / REJECTED / CHANGES_REQUESTED. | `[FIXED]` |
| PS-4 | Mentors act on their assigned track where possible; admins see all and may filter/intervene. | `[FIXED]` |

## 6. Tasks

| ID | Requirement | Tag |
|----|-------------|-----|
| TK-1 | Two generic tasks per track: TASK_1 Integration, TASK_2 Orchestration & Chaos. Same tasks apply to every problem statement in the track. | `[FIXED]` |
| TK-2 | Task states: LOCKED, REVEALED, ACTIVE, COMPLETED, CLOSED. | `[FIXED]` |
| TK-3 | Task 1 unlock costs credits (40 CC default, range 30–50 configurable). | `[CONFIG]` |

## 7. Credit Economy

| ID | Requirement | Tag |
|----|-------------|-----|
| CR-1 | Opening balance 1,000 CC issued in PHASE_0. | `[FIXED]` default, `[CONFIG]` value |
| CR-2 | Append-only CreditTransaction ledger: id, teamId, amount, type, source, reference, balanceAfter, createdAt, createdBy. Balance also cached on team row, updated only inside DB transactions with the ledger. | `[FIXED]` |
| CR-3 | Transaction types: STARTING_BALANCE, TASK_UNLOCK, FEATURE_PURCHASE, ARENA_REWARD, CASINO_STAKE, CASINO_REWARD, CASINO_PENALTY, ADMIN_ADJUSTMENT. | `[FIXED]` set, extensible |
| CR-4 | Every mutation is server-side; participants see balance, spent, earned, history. | `[FIXED]` |
| CR-5 | Credits count down toward minimum threshold of 100 CC — unspent balance costs points (see Scoring). | `[FIXED]` |

## 8. Feature Store

| ID | Requirement | Tag |
|----|-------------|-----|
| FS-1 | Opens PHASE_1, open through PHASE_2. Categories: Tool Modules, Defensive Buffs, Offensive Sabotage. | `[FIXED]` |
| FS-2 | Item fields: name, description, category, cost, effect, track availability, purchase limits, active flag. | `[FIXED]` |
| FS-3 | Purchase flow: client request → validation → phase check → availability check → balance check → DB transaction → ledger → purchase record → realtime broadcast. | `[FIXED]` |
| FS-4 | Seed items (Python REPL Sandbox 400, Vector Memory Engine 350, Air-Gap Guardrail Shield 300, Schema Inspector 250, Prompt-Poison Injection 350, Network Lag Spike 200) are **illustrative** pending track-owner input. | `[CONFIG]` |
| FS-5 | Sabotage effects target rival teams; impact must be capped so weaker teams are not crushed. | `[REC]` cap implemented as config |

## 9. Game Arena

| ID | Requirement | Tag |
|----|-------------|-----|
| GA-1 | Open to every team from PHASE_1 through end of PHASE_2; no balance gate. | `[FIXED]` |
| GA-2 | Max 4 runs per team across the event; one member plays at a time. | `[FIXED]` numbers `[CONFIG]` |
| GA-3 | Result determined server-side; successful run awards credits (~ one small component's cost). | `[FIXED]` mechanic, `[CONFIG]` payout |
| GA-4 | Arena costs time not credits; entry is free. All runs auditable; operator/admin can monitor and judge. | `[FIXED]` |
| GA-5 | Mini-games themselves are pending selection → simple skill-neutral demo mini-games, configurable. | `[CONFIG]` |

## 10. Casino Royale

| ID | Requirement | Tag |
|----|-------------|-----|
| CS-1 | Three tiers: The Vault (100% safe, no bonus/penalty), The Overclock (fixed 200 CC wager; 50% win Tier-1 API key perk / 50% loss 3s tool-lag penalty), The High-Roller (35% of current balance; 30% win 2.5x score multiplier on Gauntlet points / 70% loss deducts 35% of total CC immediately). | `[FIXED]` mechanics, `[CONFIG]` numbers |
| CS-2 | Bust protection: balance can never drop below 300 CC from casino losses. Enforced server-side. | `[FIXED]` number `[CONFIG]` |
| CS-3 | Server decides outcomes; frontend only animates. Store wager, pre-balance, result, post-balance, reward/penalty, timestamp. | `[FIXED]` |
| CS-4 | Open during PHASE_3 only; all teams lock wagers before Phase 4 (admin advance or auto-close). | `[FIXED]` |

## 11. Scoring

| ID | Requirement | Tag |
|----|-------------|-----|
| SC-1 | Final Score = (Gauntlet Points × Casino Multiplier) + Credit Discipline Score. | `[FIXED]` |
| SC-2 | Credit Discipline = 150 × (1 − (B − T) / (S − T)) with B=final balance end of PHASE_3, T=100, S=1000; floored at 0, capped at 150; balance below threshold scores full 150. | `[FIXED]` formula, `[CONFIG]` constants |
| SC-3 | Gauntlet metrics (1,000 max): Accuracy & Output Validity 40%, Adversarial Resilience 25%, Latency & Speed 20%, Token Efficiency 15%. | `[FIXED]` weights `[CONFIG]` |
| SC-4 | Dedicated ScoringService; transparent breakdown shown to participants; rankings computed after PHASE_4 evaluation completes. | `[FIXED]` |

## 12. Gauntlet (Evaluation)

| ID | Requirement | Tag |
|----|-------------|-----|
| GT-1 | Pipeline: submission → validation → queue → evaluator worker → test execution → metrics → score → leaderboard. | `[FIXED]` |
| GT-2 | 10 adversarial payloads per track (prompt injections, rate limits, corrupt schemas) each with pass/fail conditions — payload sets pending → seeded demo payloads. | `[CONFIG]` |
| GT-3 | Clean interfaces: Evaluator, EvaluationJob, EvaluationResult, TestCase, MetricResult — Docker execution layer pluggable later; demo uses simulated evaluation. | `[FIXED]` architecture |
| GT-4 | Zero-touch live run during PHASE_4; progress visible to spectators/participants. | `[FIXED]` |

## 13. Submissions

| ID | Requirement | Tag |
|----|-------------|-----|
| SB-1 | Submit repo URL or drive link (+ optional file upload abstraction); validated; timestamped. | `[FIXED]` |
| SB-2 | Lock after submission; edits prevented once locked; status tracked through evaluation lifecycle. | `[FIXED]` |
| SB-3 | Submission window tied to PHASE_4 (submission & arena open). | `[FIXED]` |

## 14. Leaderboard

| ID | Requirement | Tag |
|----|-------------|-----|
| LB-1 | Real-time leaderboard: rank, team, track, Gauntlet score, Casino modifier, Credit Discipline score, final score, current CC. | `[FIXED]` |
| LB-2 | Computed from real backend state; live updates over Socket.IO; spectator screen updates without refresh. | `[FIXED]` |

## 15. Admin

| ID | Requirement | Tag |
|----|-------------|-----|
| AD-1 | Portal: phase control, countdown, task reveals, broadcasts, PS approval oversight, credit adjustments, team/Arena/Casino/submission/Gauntlet monitoring, leaderboard, system health. | `[FIXED]` |
| AD-2 | Admin action audit log for every mutating action. | `[FIXED]` |
| AD-3 | Arena Operator duties (verify eligibility, judge outcomes, credit winnings) folded into admin portal for the demo. | `[FIXED]` operational simplification, documented |

## 16. Mentor

| ID | Requirement | Tag |
|----|-------------|-----|
| MN-1 | Mentor dashboard: pending problem statements with track context, approve/reject/request-changes with notes. Independent from admin. | `[FIXED]` |
| MN-2 | Mentors assist with environment setup; 1 mentor per ~5 teams (staffing info, reflected in seed ratios). | `[FIXED]` informational |

## 17. Spectator / Main Stage

| ID | Requirement | Tag |
|----|-------------|-----|
| SP-1 | Dedicated 1080p projector display: event branding, current phase, giant timer, live leaderboard/top teams, announcements, recent activity feed, Casino results, Gauntlet status/node graph. | `[FIXED]` |
| SP-2 | Distinct from participant dashboard; large-screen optimized; updates live. | `[FIXED]` |

## 18. Infrastructure & Quality

| ID | Requirement | Tag |
|----|-------------|-----|
| IN-1 | Stack: Next.js+TS+Tailwind+shadcn-style+Framer Motion+Recharts; Express+TS; Socket.IO REST; PostgreSQL+Prisma; Redis; BullMQ; Zod; cookie sessions+RBAC; storage abstraction (local→S3); Vitest; Playwright; Docker Compose; GitHub Actions; Sentry-compatible error hook. | `[FIXED]` |
| IN-2 | Modular monolith backend: services own business rules, controllers thin, typed responses. | `[FIXED]` |
| IN-3 | Security: server-side decisions for credits/phases/timers/scores/casino/permissions/locks; validation, authorization, rate limiting, DB transactions, audit logs; evaluator isolates untrusted code when real execution lands. | `[FIXED]` |
| IN-4 | `.env.example` with DATABASE_URL, REDIS_URL, AUTH_SECRET, API URL, S3 vars, optional Sentry, evaluator config. Never commit secrets. | `[FIXED]` |
| IN-5 | Docker Compose local stack: postgres, redis, backend, frontend, evaluator worker. | `[FIXED]` |
| IN-6 | CI: install → lint → typecheck → unit tests → build (Playwright where stable). | `[FIXED]` |
| IN-7 | Seed/demo data: event, tracks, tasks, Feature Store items, users of every role, teams, sample transactions/leaderboard; demo credentials documented in dev docs only. | `[FIXED]` |
| IN-8 | UX: white/black/purple minimal premium design; selective motion; responsive; tooltips/help so non-PRD-readers can operate. | `[FIXED]` |
