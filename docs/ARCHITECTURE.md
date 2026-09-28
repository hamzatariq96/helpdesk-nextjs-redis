# Architecture notes

## Where Redis is used, and why

| Use | Key pattern | Why Redis |
|---|---|---|
| Sessions | `session:<random id>` | Revocable immediately on logout, and no DB lookup per request. The expiry slides on every read. |
| Login rate limit | `ratelimit:login:<ip>:<email>` | Atomic counters with a TTL. `SET NX EX` and `INCR` run in one `MULTI`, so a counter never exists without an expiry. |
| Dashboard / report cache | `cache:dashboard:stats`, `cache:reports:summary` | Aggregates are the most expensive queries and are read on every dashboard load. |
| Live updates | channel `tickets:events` | Pub/sub reaches every app instance, so it keeps working with more than one server. |

## Caching strategy

Cache-aside with a short TTL (30s dashboard, 120s reports) **plus explicit
invalidation**. Every write in `repositories/tickets.ts` goes through
`afterWrite()`, which deletes the affected keys before publishing the event. The
next read therefore rebuilds from PostgreSQL, and a user who just changed
something never sees the old numbers. The TTL is only a safety net for changes
made outside the app.

## Database

- Plain SQL migrations (`db/migrations`), applied once each and in a transaction, tracked in `schema_migrations`.
- `CHECK` constraints for status, priority, role and title length, so bad data is rejected even if app validation is bypassed.
- Indexes match the queries the app actually runs:
  - `(status, updated_at DESC)` for the default ticket list
  - `(assignee_id, status)` for "my tickets" and the workload report
  - partial index on `resolved_at` for resolution-time reporting
- The dashboard is **one** query using `COUNT(*) FILTER (...)`, not one query per card.
- The ticket list uses `COUNT(*) OVER()` to get the page and the total in one round trip.
- Search escapes `%` and `_`, so user input can't act as a wildcard.

## Consistency

- Status changes lock the row (`SELECT … FOR UPDATE`) before checking the
  transition. Two agents acting at the same moment can't produce an invalid state.
- `resolved_at` is set when a ticket first becomes resolved or closed, kept when
  a resolved ticket is closed, and cleared when it is reopened.
- The SLA rules live in one place (`lib/sla.ts`). The dashboard's SQL `CASE` is
  generated from the same constants the UI uses.

## Auth

- Middleware at the edge only checks that a cookie exists (cheap). The real
  session check against Redis happens in `requireUser` / `requireApiUser`.
- A login with an unknown email still runs bcrypt against a dummy hash, so the
  response time doesn't reveal which accounts exist.
- The rate limit key includes the client address, so an attacker can't lock a
  real user out from every location.

## Real-time

The `/api/events` route opens a dedicated Redis subscriber per connected tab,
streams events as SSE, sends a heartbeat comment every 25s to keep proxies from
closing the connection, and disconnects the subscriber when the browser goes
away. On the client, `LiveUpdates` debounces bursts of events into one
`router.refresh()`, which re-renders the server components with fresh data.

## Tests

- **Unit:** SLA and transition rules, duration formatting, input parsing.
- **Integration:** run against real PostgreSQL and Redis, the same as production:
  sessions and sliding TTL, rate limiting, cache hit/invalidation, login
  lockout, filtering and pagination, transitions, pub/sub events, dashboard
  and report numbers.
- Each test file starts from a fresh schema, and each test from empty tables and
  an empty Redis DB. Tests use their own database and Redis DB index.
