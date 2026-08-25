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

> **Demo/development credentials.** The seed ships these development accounts — **use only in local
> development, never in production**. The password for **every** demo account is `password123`.
>
> | Account | Role | Email |
> | --- | --- | --- |
> | Admin | ADMIN | `admin@colosseum.dev` |
> | Mentor (FinTech) | MENTOR | `mentor.fintech@colosseum.dev` |
> | Mentor (CyberSec) | MENTOR | `mentor.cybersec@colosseum.dev` |
> | Spectator (host) | SPECTATOR | `mc@colosseum.dev` |
> | Team Captain | PARTICIPANT + CAPTAIN | `captain.prime@colosseum.dev` |
> | Team Captain | PARTICIPANT + CAPTAIN | `captain.null@colosseum.dev` |
> | Team Captain | PARTICIPANT + CAPTAIN | `captain.over@colosseum.dev` |
> | Team Captain | PARTICIPANT + CAPTAIN | `captain.chaos@colosseum.dev` |

## Authentication & Roles

### Role model

Application roles are separated into **global** roles (what an account is allowed to do across the
app) and **team** roles (what a user is within a specific team).

- **Global roles** (`User.role`): `PARTICIPANT`, `MENTOR`, `ADMIN`, `SPECTATOR`.
  `User.role` is the authority and is always resolved server-side from the session; the client never
  declares it.
- **Team roles** (`TeamMember.teamRole`): `MEMBER`, `CAPTAIN`. A captain is a participant who holds
  team-level permissions inside their own team only — being a captain grants **no** global
  admin/mentor powers.
- **User status** (`User.status`): `ACTIVE` or `DEACTIVATED`. Deactivated users are rejected at
  session resolution and cannot log in; their existing sessions are cleared on deactivation.

### Normal registration

Public registration (`POST /api/auth/register`) always creates a **PARTICIPANT**. The server strips
and ignores any client-supplied `role` — registering with `role: "ADMIN"` yields a `PARTICIPANT`.
There is no role selector in the UI. Registration requires an optional-but-encouraged matching
`confirmPassword`.

Password policy: minimum 8 characters; passwords are stored as bcrypt hashes; sessions are opaque
random tokens stored hashed (SHA-256) server-side in an httponly cookie.

### Privileged roles

- **MENTOR** (and team **CAPTAIN**) are granted only through an **admin-issued invitation**
  (`POST /api/admin/invitations`). Invitations are cryptographically random tokens of which only the
  SHA-256 hash is stored, are single-use, expire after 7 days, and are permanently invalid after
  use or expiry. `ADMIN` is **never** inviteable through this endpoint.
- The invitee completes account setup at `GET /invitation?token=…` →
  `POST /api/auth/register/invitation`. The server validates the token, checks expiry and single-use,
  then assigns the invitation's role and (for CAPTAIN invitations) joins the user to the invited team
  as **CAPTAIN** — all inside a single database transaction. The raw token is returned once to the
  admin as a shareable link.

### Team captains

Two supported paths:

1. **A participant creates a team** (`POST /api/teams`) → the creator's membership is created with
   `teamRole = CAPTAIN`; the user's **global role stays PARTICIPANT**.
2. **An admin assigns a captain** from **User Management** (`POST /api/admin/teams/:teamId/captain`),
   demoting any existing captain to `MEMBER`.

### User Management (admin)

`GET /api/admin/users` lists every account with global role, status, team and team role.
Actions (all admin-only, all audit-logged):

| Endpoint | Purpose |
| --- | --- |
| `POST /api/admin/invitations` | Issue a MENTOR or team-CAPTAIN invitation |
| `POST /api/admin/users/:id/deactivate` | Block an account (clears sessions) |
| `POST /api/admin/users/:id/activate` | Re-enable an account |
| `POST /api/admin/users/:id/role` | Reassign global role (never your own, never last-admin demotion) |
| `POST /api/admin/teams/:teamId/captain` | Make a member the captain |
| `DELETE /api/admin/teams/:teamId/captain` | Remove the captain (all members → MEMBER) |

### Permission matrix

| Capability | Participant | Captain | Mentor | Admin |
| --- | --- | --- | --- | --- |
| Normal app access | ✔ | ✔ | N/A (mentor dashboard) | ✔ |
| Own team (view) | ✔ | ✔ | — | ✔ |
| Manage own team (track, captain actions) | — | ✔ | — | ✔ |
| Mentor reviews (problem statements) | — | — | ✔ | ✔ |
| Event controls | — | — | — | ✔ |
| User management | — | — | — | ✔ |
| Credit admin adjustments | — | — | — | ✔ |
| Admin role management | — | — | — | ✔ |

Authorization is enforced **server-side** on every protected endpoint (`requireRole`, `requireTeam`,
`requireTeamCaptain`). UI gating is presentational only and never the security boundary. A captain
may only act within their own team; a mentor cannot reach admin endpoints; no client-supplied role
is ever trusted.

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
