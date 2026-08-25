# Authentication & Roles

## Role model

Two independent layers:

**Global roles** (`User.globalRole`) — what a user *is* in the application:

| Role | How it can be obtained |
|------|------------------------|
| `PARTICIPANT` | Default for **every** public registration |
| `MENTOR` | Only via an admin-issued invitation, or an admin changing an eligible account |
| `ADMIN` | Seeded / manually provisioned only — never invitable, never self-registerable |

**Team-level roles** (`TeamMembership.teamRole`) — scoped to one team:

| Role | How it is obtained |
|------|--------------------|
| `MEMBER` | Joining a team with its invite code |
| `CAPTAIN` | Creating the team (creator becomes captain), or being promoted by an admin |

A captain is still `globalRole = PARTICIPANT`; captaincy grants no global privileges.

## Normal registration

`POST /api/auth/register` accepts exactly `{ name, email, password }`. The server
assigns `globalRole = PARTICIPANT` unconditionally — any client-supplied role field
(`role: "ADMIN"`, …) is stripped by validation and never reaches the database.
There is no role selector anywhere in the public UI.

## Privileged accounts: invitations

Admins create single-use invitations from **User Management → Invite user**
(`POST /api/admin/users/invite`, role restricted to `MENTOR | CAPTAIN`):

1. Server generates a cryptographically random token (32 bytes).
2. Only the SHA-256 hash is stored; the raw token appears exactly once in the
   admin's response as `/invite/<token>`.
3. The invitee opens that link, sees a fixed role banner ("You're invited to join
   Agent Colosseum as a Mentor"), and completes name + password.
4. Acceptance validates hash → expiry → unused status, claims the invitation and
   creates the account **transactionally** with the stored role. CAPTAIN invites
   also create the team membership with `teamRole = CAPTAIN`.
5. Used/expired/revoked invitations return HTTP 410.

ADMIN is deliberately excluded from invitable roles. Admin provisioning is done by
the seed or direct DB access by a trusted operator.

## Team creation

Any participant may create a team (`POST /api/teams`); the creator's membership is
created with `teamRole = CAPTAIN`. Their global role remains `PARTICIPANT`.

## Session handling

Sessions are opaque random tokens; only their hashes are stored. Cookies are
httpOnly + SameSite=Lax (+ Secure in production). No role claims live inside
session tokens — every request re-reads the user from the database, so global-role
changes apply on the next request with zero token invalidation work.

Suspended (`status = SUSPENDED`) users fail session resolution immediately (their
live sessions are deleted on suspension) and cannot log in.

## Permission matrix

| Capability | Participant | Captain | Mentor | Admin |
|---|---|---|---|---|
| Normal app access | YES | YES | YES | YES |
| Own team data | YES | YES | NO* | YES |
| Manage own team (track change) | NO | YES | NO | via tools |
| Mentor reviews (problem statements) | NO | NO | YES | YES |
| Event controls (phases/reveals/broadcasts) | NO | NO | NO | YES |
| User management & invitations | NO | NO | NO | YES |
| Credit adjustments | NO | NO | NO | YES |
| Grant/revoke ADMIN | NO | NO | NO | manual only |

\* Mentors see problem-statement review queues, not private team dashboards.

Enforcement lives entirely in backend middleware (`authOptional`,
`requireAuth`, `requireRole`/`requireGlobalRole`, `requireTeamCaptain`) plus
route-level gates; the frontend hides controls but never guards anything by itself.

## Admin user management

`GET /api/admin/users` lists name, email, global role, team, team role, status,
created-at. Admin actions: invite mentor/captain, revoke pending invites,
deactivate/reactivate accounts, switch PARTICIPANT ↔ MENTOR, assign/remove team
captain. Guards: ADMIN accounts are immutable through these endpoints, you cannot
suspend yourself, granting ADMIN is impossible by schema validation.

## Development/demo credentials

Created idempotently by `npm run db:seed`. **DEVELOPMENT ONLY — never use these
values outside local demo environments.**

| Account | Email | Password |
|---|---|---|
| Admin | `admin@colosseum.dev` | `password123` |
| Mentors | `mentor.fintech@colosseum.dev`, `mentor.cybersec@colosseum.dev` | `password123` |
| Captains (teamRole=CAPTAIN) | `captain.prime|null|over|chaos@colosseum.dev` | `password123` |
| Members | `mate.prime@…`, `mate.null@…`, `mate.chaos@…` | `password123` |

Re-running the seed updates nothing but missing rows — no duplicate users or
memberships are ever created.
