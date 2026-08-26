# Deploying to Cloudflare (Workers)

Two Workers make up the deployment:

| Worker | Source | Config |
|---|---|---|
| `colosseum-api` | `backend/src/worker.ts` (Hono) | `backend/wrangler.jsonc` |
| `colosseum-web` | Next.js via OpenNext | `frontend/wrangler.jsonc` |

Local/docker deployments keep using the full Express app (`src/server.ts`) —
both runtimes share the same services and database.

## Prerequisites (one-time, you)

1. **Cloudflare account** (free): https://dash.cloudflare.com/sign-up
2. From the repo root: `npx wrangler login` → approve in browser
3. During first deploy, pick your `workers.dev` subdomain

## Secrets & vars (you + me)

Backend worker needs two **secrets** (never in git):

```bash
cd backend
npx wrangler secret put DATABASE_URL   # paste Supabase POOLED url (port 6543), sslmode=require
npx wrangler secret put AUTH_SECRET    # openssl rand -hex 48
```

Non-secret vars live in `backend/wrangler.jsonc` (`CORS_ORIGIN`) — set it to your
final frontend URL (e.g. `https://colosseum-web.<subdomain>.workers.dev`).

For local Worker testing, copy `.dev.vars.example` → `.dev.vars` (gitignored).

## Build & deploy

```bash
# API
npm run cf:backend            # builds backend dist + wrangler deploy

# Web  (set your real API URL first — it is baked at build time)
cd frontend
# edit wrangler.jsonc vars.NEXT_PUBLIC_API_URL to https://colosseum-api.<subdomain>.workers.dev
pnpm cf:build && pnpm cf:deploy
```

Then set `CORS_ORIGIN` on the API worker to the web URL:

```bash
cd backend && npx wrangler vars put CORS_ORIGIN https://colosseum-web.<subdomain>.workers.dev
```

## Local verification without deploying

```bash
cd backend
cp .dev.vars.example .dev.vars   # fill in real values (gitignored)
npm run cf:build
npm run cf:dev                   # miniflare with local DOs; hits Supabase directly
curl localhost:8787/api/health
```

## Architecture notes / current scope on Workers

- **Included**: auth/session cookies, event state + phase gates (lazy advance),
  tracks, teams create/join/regenerate/view (+ capacity race safety via row
  locks), leaderboard, activity feed, WebSocket hub (Durable Object),
  join-attempt rate limiter (DO), inline simulated Gauntlet evaluation.
- **Node-only for now** (documented limitation): Feature Store purchases,
  Game Arena play, Casino bets, submissions/Gauntlet enqueue, admin console
  APIs, problem-statement review, file uploads. These still work on any
  Node host (docker/VPS) via `src/server.ts`.
- Realtime uses native WebSocket frames `{event, payload}`; the Node path keeps
  Socket.IO behind the same client interface (`frontend/lib/realtime.tsx`).

## Free-tier guardrails

- Workers free: 100k req/day · 10 ms CPU/req — endpoints are I/O-bound ✅
- Durable Objects free: 100k req/day — timer ticks are client-side ✅
- ⚠️ Supabase free projects **pause after ~7 days idle**: open the project or
  hit an endpoint weekly; upgrade before event day if the date is far out.
