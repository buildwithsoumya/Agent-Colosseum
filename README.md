# Agent Colosseum

A full-stack event platform for **Agent Colosseum** — a multi-stage, gamified hackathon where teams build autonomous AI agents under a live credit economy, adversarial chaos, Casino Royale risk wagering and a zero-touch final evaluation (the **Colosseum Gauntlet**).

This repository is the complete working demo: public website, participant app, mentor desk, admin control center, spectator main-stage display — all driven by a real backend with PostgreSQL persistence, Redis/BullMQ job queues and Socket.IO realtime.

## Product sources

- `docs/Agent_Colosseum_PRD_v2.pdf` — product source of truth
- `docs/requirements.md` — extracted requirements (`[FIXED]` vs `[CONFIG]`)
- `docs/implementation-plan.md` — requirement → module mapping

## Architecture at a glance

```
frontend/   Next.js 15 · React 19 · Tailwind v4 · Framer Motion · Recharts
backend/    Express + TypeScript · Prisma/PostgreSQL · Socket.IO · BullMQ producer
evaluator/  BullMQ worker · simulated Gauntlet evaluation (Docker seam ready)
shared/     zod contracts, phase model, socket events, pure scoring math
```

- The **backend** is the single source of truth: phases, timers, credits, casino outcomes, scores.
- The **database** holds durable state; every credit mutation goes through an append-only ledger inside serializable transactions.
- **Redis + BullMQ** carry Gauntlet evaluation jobs; the evaluator publishes progress over Redis pubsub which fans out through Socket.IO.
- The **frontend** never decides anything — it renders server state.

See `docs/architecture.md` for details.

## Quick start (WSL2 / Linux / macOS)

Requirements: Node ≥ 20 (22 recommended), pnpm 9, Docker Desktop (or any Docker) for Postgres + Redis.

```bash
git clone https://github.com/buildwithsoumya/Agent-Colosseum.git
cd Agent-Colosseum

cp .env.example .env          # defaults work for local dev

docker compose up -d postgres redis
pnpm install

npm run db:migrate            # applies committed migrations
npm run db:seed               # demo event, tracks, users, store, payloads

npm run dev                   # backend :4000 + frontend :3000 (+ evaluator in another terminal)
npm run stop                  # free the dev ports if something is stuck (cross-platform)
npm run dev:evaluator         # gauntlet worker (required for Phase 4 evaluation)
```

Open http://localhost:3000 — the login screen lists demo accounts.

### Demo accounts (development seed only)

| Role | Email | Password |
|------|-------|----------|
| Admin controller | `admin@colosseum.dev` | `password123` |
| Mentor (FinTech) | `mentor.fintech@colosseum.dev` | `password123` |
| Mentor (CyberSec) | `mentor.cybersec@colosseum.dev` | `password123` |
| Captains | `captain.prime@…`, `captain.null@…`, `captain.over@…`, `captain.chaos@…` | `password123` |
| Spectator | no login needed — visit `/spectator` | — |

### Running the full event flow

1. Log in as **admin** → `/admin` → press **Start** (Phase 0 begins).
2. As a **participant**: create/join a team, pick a track, submit your problem statement.
3. As a **mentor**: approve it at `/mentor`.
4. Back as admin: **Advance phase** → Task 1 reveals. Participants unlock it (−40 CC), buy Feature Store items, play the Arena.
5. Advance through Phase 2 → Phase 3 (**Casino Royale**) → place wagers.
6. Advance to Phase 4 → participants submit & lock → the evaluator runs automatically → leaderboard updates live on `/spectator`.

## Development commands

| Command | Purpose |
|---------|---------|
| `npm run dev` | backend + frontend dev servers |
| `npm run dev:backend` / `dev:frontend` / `dev:evaluator` | individually |
| `npm run build` | build all packages |
| `npm run typecheck` / `lint` | strict TS across packages |
| `npm run test` | Vitest unit suites (pure logic) |
| `RUN_DB_TESTS=1 npm test` (backend pkg) | DB-backed ledger tests |
| `npm run db:migrate` / `db:seed` / `db:studio` | Prisma |
| `docker compose up -d` | full stack in containers |

### End-to-end tests (Playwright)

```bash
# once: npx playwright install chromium && sudo npx playwright install-deps chromium
# stack running, then:
RUN_E2E=1 npx playwright test
```

The suite resets the demo event via the admin API and walks the journey as a real user.

## Environment variables

See `.env.example`. Key ones: `DATABASE_URL`, `REDIS_URL`, `AUTH_SECRET` (generate: `openssl rand -hex 48`), `BACKEND_PORT`, `CORS_ORIGIN`, storage driver (`local` | `s3`), optional `SENTRY_DSN`. Never commit real credentials.

## Documentation

- `docs/architecture.md` — system design, data flows, security model
- `docs/event-engine.md` — phase state machine, timers, gates, reveal rules
- `docs/api.md` — REST endpoints + Socket.IO events
- `docs/development.md` — WSL/Docker Desktop notes, troubleshooting, seed details

## Branching

`main` holds stable integrated demos. Work happens on `develop` via `feature/*`, `fix/*`, `docs/*`, `refactor/*` branches merged by PR. See commit history for the logical breakdown.
