-- Private recruitment data. Public snapshots are imported explicitly, never at build time.
-- All dates use ISO 8601 UTC strings. JSON columns are validated at the Worker boundary.
CREATE TABLE IF NOT EXISTS opportunities (
  id TEXT PRIMARY KEY CHECK (length(id) = 20),
  payload_json TEXT NOT NULL CHECK (json_valid(payload_json)),
  snapshot_version INTEGER NOT NULL CHECK (snapshot_version = 2),
  snapshot_generated_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS opportunities_snapshot_idx ON opportunities(snapshot_generated_at, id);

CREATE TABLE IF NOT EXISTS interactions (
  id TEXT PRIMARY KEY,
  opportunity_id TEXT,
  kind TEXT NOT NULL,
  occurred_at TEXT NOT NULL,
  note TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL,
  revision INTEGER NOT NULL DEFAULT 1 CHECK (revision > 0),
  FOREIGN KEY (opportunity_id) REFERENCES opportunities(id) ON DELETE RESTRICT
);
CREATE INDEX IF NOT EXISTS interactions_opportunity_idx ON interactions(opportunity_id, occurred_at);

CREATE TABLE IF NOT EXISTS pipeline_events (
  id TEXT PRIMARY KEY,
  opportunity_id TEXT,
  event_type TEXT NOT NULL,
  event_json TEXT NOT NULL DEFAULT '{}' CHECK (json_valid(event_json)),
  occurred_at TEXT NOT NULL,
  FOREIGN KEY (opportunity_id) REFERENCES opportunities(id) ON DELETE RESTRICT
);
CREATE INDEX IF NOT EXISTS pipeline_events_opportunity_idx ON pipeline_events(opportunity_id, occurred_at);

CREATE TABLE IF NOT EXISTS sync_cursors (
  source TEXT PRIMARY KEY,
  cursor_json TEXT NOT NULL CHECK (json_valid(cursor_json)),
  revision INTEGER NOT NULL DEFAULT 1 CHECK (revision > 0),
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS tasks (
  id TEXT PRIMARY KEY,
  opportunity_id TEXT,
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'done', 'cancelled')),
  title TEXT NOT NULL,
  due_at TEXT,
  detail_json TEXT NOT NULL DEFAULT '{}' CHECK (json_valid(detail_json)),
  revision INTEGER NOT NULL DEFAULT 1 CHECK (revision > 0),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (opportunity_id) REFERENCES opportunities(id) ON DELETE RESTRICT
);
CREATE INDEX IF NOT EXISTS tasks_status_idx ON tasks(status, due_at);

CREATE TABLE IF NOT EXISTS audit_events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  action TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id TEXT NOT NULL,
  occurred_at TEXT NOT NULL,
  detail_json TEXT NOT NULL DEFAULT '{}' CHECK (json_valid(detail_json))
);
CREATE INDEX IF NOT EXISTS audit_events_time_idx ON audit_events(occurred_at);

-- Reviews retain entries for closed/unlisted opportunities, so no foreign key to the public snapshot.
CREATE TABLE IF NOT EXISTS reviews (
  opportunity_id TEXT PRIMARY KEY CHECK (length(opportunity_id) = 20),
  status TEXT NOT NULL CHECK (status IN ('new', 'reviewed', 'shortlisted', 'dismissed')),
  note TEXT NOT NULL CHECK (length(note) <= 500),
  updated_at TEXT NOT NULL,
  revision INTEGER NOT NULL DEFAULT 1 CHECK (revision > 0)
);

-- The unique key makes a one-time legacy migration atomic and repeat-safe.
CREATE TABLE IF NOT EXISTS completed_imports (
  source TEXT PRIMARY KEY,
  checksum TEXT NOT NULL,
  imported_at TEXT NOT NULL,
  record_count INTEGER NOT NULL CHECK (record_count >= 0)
);
