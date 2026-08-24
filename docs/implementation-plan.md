# Agent Colosseum — Implementation Plan

Maps requirements (`docs/requirements.md`) to concrete modules. Branch/commit strategy per `README` §Branching.

## Repository Layout

```
agent-colosseum/
├── frontend/                 # Next.js (App Router) presentation layer
│   ├── app/(public)/…        # landing, about, how-it-works, timeline, tracks, feature-store,
│   │                         # game-arena, casino, leaderboard, rules, faq, login
│   ├── app/app/…             # participant dashboard (auth-gated)
│   ├── app/admin/…           # admin portal (ADMIN)
│   ├── app/mentor/…          # mentor dashboard (MENTOR)
│   ├── app/spectator/        # 1080p main-stage display
│   └── components/           # ui primitives (shadcn-style), event widgets, charts
├── backend/
│   └── src/
│       ├── config/           # env loading (zod-validated)
│       ├── lib/              # prisma client, redis, logger, errors, socket emitter
│       ├── middleware/       # auth session, requireRole, rate limit, zod validate, audit
│       ├── modules/
│       │   ├── auth/         # AU-*  register/login/logout/me + sessions
│       │   ├── teams/        # TM-*
│       │   ├── tracks/       # TR-*
│       │   ├── problems/     # PS-*
│       │   ├── tasks/        # TK-*
│       │   ├── credits/      # CR-*  CreditService (ledger, atomic)
│       │   ├── store/        # FS-*
│       │   ├── arena/        # GA-*
│       │   ├── casino/       # CS-*
│       │   ├── scoring/      # SC-*  ScoringService
│       │   ├── submissions/  # SB-*
│       │   ├── gauntlet/     # GT-1 queue producer + status
│       │   ├── leaderboard/  # LB-*
│       │   ├── event/        # EE-*  EventEngine state machine + admin controls
│       │   ├── announcements/# broadcasts
│       │   └── admin/        # AD-*  overview, adjustments, audit log
│       └── server.ts         # express + socket.io bootstrap
├── evaluator/
│   └── src/
│       ├── worker.ts         # BullMQ consumer
│       ├── types.ts          # Evaluator / EvaluationJob / EvaluationResult / TestCase / MetricResult
│       ├── evaluators/
│       │   ├── simulated.ts  # demo evaluation (deterministic seeded)
│       │   └── docker.ts     # stub interface for future container execution
│       └── scoring-hook.ts   # persists results → ScoringService → leaderboard emit
├── shared/
│   └── src/                  # zod schemas + TS types shared FE/BE (api contracts, socket events)
├── docs/                     # PRD sources + requirements/plan/architecture/api/event-engine/development
├── scripts/                  # dev helpers (cross-platform node)
├── docker-compose.yml        # postgres, redis, backend, frontend, evaluator
├── .env.example
└── README.md
```

## Requirement → Module Map

| Area | Req IDs | Backend module | Frontend surfaces | Key tests |
|------|---------|----------------|-------------------|-----------|
| Event engine | EE-1..7 | `modules/event` EventEngineService | admin phase panel, dashboards timer, spectator | unit: transitions, pause math; e2e: advance |
| Auth/RBAC | AU-1..4 | `modules/auth`, `middleware/auth` | login page, route guards | unit: RBAC matrix |
| Teams | TM-1..3 | `modules/teams` | onboarding wizard, team card | unit: join codes |
| Tracks | TR-1..3 | seed + `modules/tracks` | public tracks page, track select | — |
| Problem statements | PS-1..4 | `modules/problems` | participant submit, mentor review queue | e2e approve flow |
| Tasks | TK-1..3 | `modules/tasks` | task cards w/ states | unit: reveal gating |
| Credits | CR-1..5 | `modules/credits` CreditService | wallet widget, history table | unit: ledger invariants (heavy) |
| Feature Store | FS-1..5 | `modules/store` | store grid, purchase dialog | unit: limits/phase; e2e purchase |
| Game Arena | GA-1..5 | `modules/arena` | arena play UI, admin monitor | unit: run caps/payouts |
| Casino | CS-1..4 | `modules/casino` CasinoService | casino terminal UI, spectator results | unit: bust floor, EV boundaries |
| Scoring | SC-1..4 | `modules/scoring` ScoringService | score breakdown card | unit: formula edges (0/150/threshold/below) |
| Gauntlet | GT-1..4 | `modules/gauntlet` + evaluator svc | submission gate, progress bars | integration: simulated pipeline |
| Submissions | SB-1..3 | `modules/submissions` | submission form/lock | unit: lock enforcement |
| Leaderboard | LB-1..2 | `modules/leaderboard` | live tables everywhere | integration: ordering |
| Admin | AD-1..3 | `modules/admin` | `/admin` console | e2e smoke |
| Mentor | MN-1..2 | `modules/problems` (mentor routes) | `/mentor` queue | e2e smoke |
| Spectator | SP-1..2 | read-only endpoints + sockets | `/spectator` | visual/manual |
| Infra | IN-1..8 | config/lib/middleware | design system components | CI pipeline |

## Build Order (stages → commits)

1. **Stage A** scaffold: pnpm workspace, shared pkg, backend+frontend skeletons, docker-compose (postgres/redis), `.env.example`, CI → `chore:` commits.
2. **Stage B**: Prisma schema+migration, auth/sessions/RBAC, teams, tracks, problem statements, event engine, Socket.IO wiring.
3. **Stage C**: CreditService ledger, Feature Store, Game Arena, Casino Royale, ScoringService.
4. **Stage D**: Submissions, BullMQ gauntlet pipeline, evaluator worker (simulated), leaderboard service.
5. **Stage E**: Participant dashboard, mentor dashboard, admin console, spectator display.
6. **Stage F**: Public marketing site pages.
7. **Stage G**: Vitest suites, Playwright happy-path, security hardening (rate limits, audit), docs polish.

## Demo Configuration Defaults (all overridable via DB/config)

- Opening balance 1000 CC · Task-1 unlock 40 CC · Arena payout 150 CC/run · 4 runs max
- Casino: Overclock wager 200 CC @ 50% · High-Roller stake 35% @ 30% win → ×2.5 multiplier; loss −35%; bust floor 300 CC
- Discipline constants T=100, S=1000, cap 150
- Gauntlet weights accuracy .40 / resilience .25 / latency .20 / tokens .15 over 10 payloads
