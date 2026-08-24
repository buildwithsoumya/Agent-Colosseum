# Development Guide

## Environment notes (WSL2 + Docker Desktop)

This repo is developed from WSL2 Ubuntu against **Docker Desktop for Windows**:

- Docker Desktop must be running on Windows; WSL integration should be enabled for the distro
  (Docker Desktop → Settings → Resources → WSL Integration). If `docker` isn't found in PATH,
  that toggle is the fix — do not install a second daemon inside WSL.
- Keep the repository on the Linux filesystem (e.g. `~/projects/Agent-Colosseum`) rather than
  `/mnt/c|d/...` for acceptable file-watch and install performance.
- All scripts are cross-platform Node or standard Unix commands — no PowerShell/cmd assumptions.

## Setup checklist

```bash
cp .env.example .env
# generate a real secret:
openssl rand -hex 48   # → AUTH_SECRET

docker compose up -d postgres redis
pnpm install
npm run db:migrate     # applies committed migrations (prisma migrate deploy)
npm run db:seed        # idempotent demo data
```

`scripts/with-env.mjs` loads the root `.env` for Prisma CLI commands, so DB commands work from any package directory.

## Seed contents

- Event in SETUP state with default GameConfig (PRD figures: 1000 CC opening, 40 CC task unlock,
  150 CC arena payout ×4 runs, casino odds 50%/30%, bust floor 300 CC, discipline T=100/S=1000/cap=150).
- 4 tracks with illustrative task wording (FinTech wording follows the PRD worked example) +
  acceptance criteria + chaos conditions.
- 10 adversarial Gauntlet payloads per track (kinds: VALIDITY, PROMPT_INJECTION, RATE_LIMIT,
  SCHEMA_DRIFT, CORRUPT_INPUT).
- The six illustrative Feature Store items from the PRD (marked illustrative — track owners set final pricing).
- 3 demo mini-games, admin/mentors/spectator accounts, four demo teams (one PS pre-approved,
  one SUBMITTED so the mentor queue isn't empty).

Re-running the seed is safe (idempotent upserts).

## Testing

```bash
npm run test                       # pure unit suites (scoring math, evaluation aggregation)
cd backend && RUN_DB_TESTS=1 \
  DATABASE_URL="postgresql://…test-db…" pnpm exec vitest run    # ledger integration tests
```

DB tests create and clean up their own team rows; run them against a scratch database if your
demo data matters.

### Playwright e2e

```bash
npx playwright install chromium          # browser binary (~115 MB)
sudo npx playwright install-deps chromium # system libraries once per machine
RUN_E2E=1 npx playwright test            # requires backend+frontend+evaluator running
```

The suite resets the event through the admin API first, so it always starts from a known state.

## Troubleshooting

- **`docker: command not found` in WSL** — enable Docker Desktop WSL integration (see above) or
  launch Docker Desktop on Windows; verify with `docker info`.
- **Prisma says DATABASE_URL missing** — you skipped `cp .env.example .env`, or ran prisma outside
  the wrapper scripts. Use `npm run db:*` scripts.
- **pino-pretty transport error** — dev-only logger pretty-printer missing; run `pnpm install`.
- **Port already in use** — `fuser -k 4000/tcp` (backend), `3000/tcp` (frontend).
- **Casino/Arena say "only during PHASE_x"** — that's correct behaviour; advance phases as admin.

## Resetting the demo

Admin portal → *reset-demo* (dev only) wipes runtime state (transactions, bets, submissions,
scores, announcements) while keeping users/teams/catalogue. Full re-seed: drop DB, migrate, seed.
