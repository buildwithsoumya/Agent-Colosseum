# API & Realtime

Base URL: `http://localhost:4000`. All bodies JSON. Auth via `ac_session` httpOnly cookie (set by login/register). Errors: `{ "error": string, "code": string, "details?" }`.

## Auth
| Method | Path | Notes |
|---|---|---|
| POST | `/api/auth/register` | `{name,email,password}` → participant + session |
| POST | `/api/auth/login` | rate-limited 30/15min |
| POST | `/api/auth/logout` | clears session server-side |
| GET | `/api/auth/me` | `{user, team?}` |

## Event (public)
| GET `/api/event/state` | phase snapshot: label, objective, status, endsAt, secondsRemaining, gates, announcements, recent activity, stats |
|---|---|
| GET | `/api/event/activity` | spectator feed rows |

## Tracks (public)
| GET | `/api/tracks` · `/api/tracks/:key` | catalogue incl. task wording; payload kinds only |

## Teams
| Method | Path | Notes |
|---|---|---|
| POST | `/api/teams` | `{name}` → creator becomes captain; opening balance if event running |
| POST | `/api/teams/join` | `{code}` max 4 members |
| GET | `/api/teams/me` | team + members + PS status |
| PATCH | `/api/teams/me/track` | captain-only, PHASE_0 only |
| GET | `/api/teams/me/transactions` | ledger history + earned/spent totals |

## Problem statements
| Method | Path | Notes |
|---|---|---|
| PUT | `/api/problems/me` | upsert draft (DRAFT/REJECTED/CHANGES_REQUESTED editable) |
| POST | `/api/problems/me/submit` | → SUBMITTED |
| GET | `/api/problems/me` | own PS with mentor note |
| GET | `/api/problems/queue?status=` | mentor/admin queue (`mine=1` filters to assigned track) |
| POST | `/api/problems/:id/review` | `{decision: APPROVE\|REJECT\|REQUEST_CHANGES, note?}` note required unless approve |

## Tasks
| GET | `/api/tasks/me` | track tasks + per-team unlock state + cost |
|---|---|
| POST | `/api/tasks/:id/unlock` | PHASE_1 gate; charges Task-1 unlock cost from ledger |

## Feature Store
| GET | `/api/store?rivals=1` | catalogue for track, owned counts, gates, balance |
|---|---|
| POST | `/api/store/purchase` | `{featureId, targetTeamId?}` — sabotage requires rival target; per-team limits enforced |

## Game Arena
| GET | `/api/arena/state` | games, runs remaining/history |
|---|---|
| POST | `/api/arena/play` | `{gameKey}` — server decides WIN/LOSS; pays ARENA_REWARD on win |

## Casino Royale
| GET | `/api/casino/state` | tier config, bust floor, my bet |
|---|---|
| POST | `/api/casino/bet` | `{tier: VAULT\|OVERCLOCK\|HIGH_ROLLER}` one bet per team; outcome drawn server-side; bust protection applied in-transaction |

## Submissions & Gauntlet
| Method | Path | Notes |
|---|---|---|
| GET | `/api/submissions/me` · `/api/gauntlet/me` | submission/job/result/score breakdown |
| PUT | `/api/submissions/me` | `{repoUrl, notes?}` while OPEN and PHASE_4 |
| POST | `/api/submissions/me/file` | multipart upload → storage abstraction (local disk) |
| POST | `/api/submissions/me/lock` | locks + enqueues evaluation (202) |

## Leaderboard (public)
| GET | `/api/leaderboard?limit=` | rank, team, track, gauntlet, casino mult, discipline, final, CC |
|---|---|

## Admin (role ADMIN)
| Method | Path |
|---|---|
| GET | `/api/admin/overview` — phase, stats, jobs, recent audit |
| POST | `/api/admin/event/start` · `/advance` · `/pause` · `/resume` · `/reset-demo` |
| POST | `/api/admin/tasks/reveal` `{taskNumber}` |
| POST | `/api/admin/announcements` `{message, level}` |
| GET | `/api/admin/problems?status=` · POST `/api/admin/problems/:id/review` |
| POST | `/api/admin/credits/adjust` `{teamId, amount±, reason}` |
| GET | `/api/admin/teams` · `/admin/arena` · `/admin/casino` · `/admin/jobs`(via overview) · `/admin/audit` |

## Health
| GET | `/api/health` | uptime + current phase |
|---|---|

## Socket.IO events

Namespace default. Rooms: global `event`, `team:<id>`, role rooms for admin/mentor.

| Event | Payload (shape) |
|---|---|
| `phase:changed` | full PhaseSnapshot (label, objective, gates, endsAt…) |
| `timer:updated` | `{phase, secondsRemaining, endsAt, paused, serverTime}` every second |
| `task:revealed` | `{taskNumber, at}` |
| `credits:updated` | `{teamId, balance, amount, reason, at}` (team room) |
| `store:purchase` | `{teamName, feature, category, at}` |
| `arena:result` | `{teamId, game, result, reward, balance}` (team room) |
| `casino:result` | `{teamName, tier, outcome, wager, postBalance, multiplierAwarded}` |
| `leaderboard:updated` | `{entries:[…]}` full recompute |
| `submission:updated` | `{teamId, status}` |
| `gauntlet:progress` | `{teamId, stage, progress?, message}` |
| `gauntlet:completed` | `{teamId, finalScore}` |
| `announcement:new` | `{id, message, level, createdAt}` |
| `activity:new` | spectator feed item |
