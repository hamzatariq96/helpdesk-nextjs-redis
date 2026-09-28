-- Users are either admins (see reports, manage everything) or agents (work tickets).
CREATE TABLE users (
  id            SERIAL PRIMARY KEY,
  email         TEXT NOT NULL UNIQUE,
  name          TEXT NOT NULL,
  password_hash TEXT NOT NULL,
  role          TEXT NOT NULL CHECK (role IN ('admin', 'agent')),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE tickets (
  id           SERIAL PRIMARY KEY,
  title        TEXT NOT NULL CHECK (length(title) BETWEEN 3 AND 200),
  description  TEXT NOT NULL DEFAULT '',
  status       TEXT NOT NULL DEFAULT 'open'
               CHECK (status IN ('open', 'in_progress', 'resolved', 'closed')),
  priority     TEXT NOT NULL DEFAULT 'medium'
               CHECK (priority IN ('low', 'medium', 'high', 'urgent')),
  created_by   INTEGER NOT NULL REFERENCES users(id),
  assignee_id  INTEGER REFERENCES users(id) ON DELETE SET NULL,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  resolved_at  TIMESTAMPTZ
);

-- The ticket list is filtered by status and assignee and sorted by recency.
CREATE INDEX tickets_status_updated_idx   ON tickets (status, updated_at DESC);
CREATE INDEX tickets_assignee_status_idx  ON tickets (assignee_id, status);
-- Reports aggregate resolved tickets by resolution time.
CREATE INDEX tickets_resolved_at_idx      ON tickets (resolved_at) WHERE resolved_at IS NOT NULL;

CREATE TABLE ticket_comments (
  id          SERIAL PRIMARY KEY,
  ticket_id   INTEGER NOT NULL REFERENCES tickets(id) ON DELETE CASCADE,
  author_id   INTEGER NOT NULL REFERENCES users(id),
  body        TEXT NOT NULL CHECK (length(body) > 0),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX ticket_comments_ticket_idx ON ticket_comments (ticket_id, created_at);
