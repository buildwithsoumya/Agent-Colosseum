# Teams: Creation, Join Codes & Capacity

## Team creation

A signed-in participant creates a team from **Team → Create a Team**.
Server-side (`POST /api/teams`): the team row and the creator's membership are
created in one transaction — creator becomes `teamRole = CAPTAIN`, global role
stays `PARTICIPANT`. A join code is generated and returned **once** in the
response; afterwards only the captain can re-display it.

## Team join codes

- 8 characters from an ambiguity-free alphabet (no `I L O 0 1`), displayed as
  `XXXX-XXXX` (e.g. `X7K4-P9Q2`), generated with `crypto.randomInt`.
- Stored as **SHA-256 hash** (unique index) for lookup; an AES-256-GCM cipher
  (key derived from `AUTH_SECRET`) lets the captain re-display it. Plaintext is
  never persisted. Codes are accepted case-insensitively with any separators.
- Regeneration (captain or admin) invalidates the old code immediately;
  existing members are unaffected.

## Joining

**Team → Join a Team → enter code** (`POST /api/teams/join`). The backend
validates auth → event phase gate → normalized-code lookup under a row lock
(`SELECT … FOR UPDATE`) → capacity → duplicate-membership → then creates the
membership with `teamRole = MEMBER` inside one transaction. Concurrent joins for
the last slot cannot exceed capacity (covered by test).

Responses/messages: full team → "This team is full."; already enrolled →
"You're already a member of a team."; own team → "You're already the captain of
this team."; unknown/invalid → generic "Invalid or expired team join code."

## Capacity

`maxTeamSize` lives in the event's `GameConfig` (default 4, PRD-aligned but
configurable per event). The UI shows `n / max members` plus empty slots; the
backend count inside the locked transaction is authoritative.

## Team lock

Team creation/joining closes after the phase configured by
`GameConfig.teamJoinLastPhase` (default `PHASE_0`, matching the PRD onboarding
model). The gate appears as `teamCreateOpen` / `teamJoinOpen` in `/api/event/state`.

## Security

Brute-force resistance: failed join attempts are counted in Redis per account
(10 failures / 10 min → temporary block, cleared on success). Rate limits reuse
the existing middleware/Redis infrastructure. Errors are generic — no internal
detail leaks. Admins may regenerate a team's code via
`POST /api/admin/teams/:id/regenerate-code`; raw codes are not displayed in the
admin UI.

## Realtime

`team:member_joined` (Socket.IO, event + team rooms) fires on every successful
join so captain dashboards update member counts without refresh.

## Limitations

- No leave-team / captain-transfer workflow (PRD doesn't define one; documented
  as out of scope rather than invented).
- Teams created before this migration carry a `legacy` cipher: captains of those
  teams see a one-click "Generate a code now" action instead of a stored code.
