# Helpdesk

A support ticket tracker built with **Next.js (App Router), Redis and PostgreSQL**.
Agents sign in, work tickets and comment on them. Everyone's dashboard updates
live when anything changes, and admins get workload reports.

**Stack:** Next.js 14 · TypeScript · Tailwind CSS · PostgreSQL 16 · Redis 7 · Docker Compose · Jest

## Run it

You only need Docker.

```bash
make up      # builds, migrates, seeds demo data, starts on http://localhost:3000
make test    # 59 unit + integration tests against real PostgreSQL and Redis
make down    # stop and remove the database volume
```

Demo accounts (password `helpdesk123`):

| Email | Role |
|---|---|
| admin@helpdesk.test | admin (can see Reports) |
| ali@helpdesk.test | agent |
| maria@helpdesk.test | agent |

To see the live updates, sign in as two different users in two browsers and
change a ticket in one of them.

## Features

- **Auth:** email and password (bcrypt). Sessions are stored in Redis with a sliding expiry, and there are admin and agent roles.
- **Login protection:** failed attempts are rate-limited in Redis per email and client address.
- **Tickets:** create, assign, change priority and status, comment. The server enforces which status changes are allowed.
- **Filtering:** by status, assignee ("me", unassigned, or a person) and title search, with pagination.
- **Real-time:** every change is published to Redis pub/sub and streamed to open browsers over Server-Sent Events. Pages refresh their server-rendered data and show a toast.
- **Dashboard:** counts by status and priority, unassigned tickets and tickets past their SLA. Computed in one SQL query and cached in Redis.
- **Reports** (admin): per-person workload, average time to resolve, and tickets created per day over the last 14 days.

## How data moves

```
Browser ──> Next.js server components ──> Redis cache ──miss──> PostgreSQL
   │                                        ▲
   │  API routes (writes) ──> PostgreSQL ───┘ invalidate
   │                     └──> Redis PUBLISH tickets:events
   └── EventSource /api/events <── Redis SUBSCRIBE
```

Reads go through Redis first. Writes go to PostgreSQL, clear the cached
aggregates they affect, and publish an event. The SSE route relays that event to
every connected tab, whichever server instance handled the write.

[docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) explains the design decisions.

## Project layout

```
db/migrations/        plain SQL schema with indexes and constraints
scripts/              migrate + seed
src/app/              pages (server components) and API routes
src/components/       client components (forms, live updates)
src/lib/              session, cache, rate limit, events, validation, SLA rules
src/repositories/     all SQL lives here
tests/unit/           pure logic
tests/integration/    repositories, Redis features and auth against real services
```

## Local development without Docker

Needs PostgreSQL and Redis running locally.

```bash
cp .env.example .env.local       # adjust URLs if needed
npm ci
npm run db:migrate && npm run db:seed
npm run dev                      # http://localhost:3000

# tests use their own database (helpdesk_test) and Redis DB 15
TEST_DATABASE_URL=postgres://app:app@localhost:5432/helpdesk_test npm test
```
