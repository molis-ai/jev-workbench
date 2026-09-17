-- Jev Workbench v1: initial proposed SQLite schema. Timestamps are UTC ISO-8601 strings.
-- Store on a local disk; do not place the WAL database on a network filesystem.
PRAGMA foreign_keys = ON;
PRAGMA journal_mode = WAL;
PRAGMA synchronous = FULL;
PRAGMA busy_timeout = 5000;

CREATE TABLE IF NOT EXISTS schema_migrations (
  version INTEGER PRIMARY KEY,
  applied_at TEXT NOT NULL
);

CREATE TABLE functions (
  id TEXT PRIMARY KEY,
  function_key TEXT NOT NULL UNIQUE,
  display_name TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  draft_json TEXT NOT NULL CHECK(json_valid(draft_json)),
  draft_revision INTEGER NOT NULL DEFAULT 1 CHECK(draft_revision > 0),
  active_version INTEGER,
  enabled INTEGER NOT NULL DEFAULT 1 CHECK(enabled IN (0,1)),
  archived_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY(id, active_version) REFERENCES releases(function_id, version)
    DEFERRABLE INITIALLY DEFERRED
);

CREATE TABLE releases (
  function_id TEXT NOT NULL REFERENCES functions(id),
  version INTEGER NOT NULL CHECK(version > 0),
  config_json TEXT NOT NULL CHECK(json_valid(config_json)),
  config_checksum TEXT NOT NULL,
  release_note TEXT NOT NULL DEFAULT '',
  published_at TEXT NOT NULL,
  PRIMARY KEY(function_id, version)
);

CREATE TRIGGER releases_are_immutable
BEFORE UPDATE ON releases BEGIN
  SELECT RAISE(ABORT, 'Published releases are immutable; create a new version.');
END;

CREATE TRIGGER published_function_keys_are_immutable
BEFORE UPDATE OF function_key ON functions
WHEN NEW.function_key <> OLD.function_key
  AND EXISTS (SELECT 1 FROM releases WHERE function_id = OLD.id)
BEGIN
  SELECT RAISE(ABORT, 'A published function key cannot be renamed.');
END;

CREATE TABLE test_cases (
  id TEXT PRIMARY KEY,
  function_id TEXT NOT NULL REFERENCES functions(id),
  name TEXT NOT NULL,
  input_json TEXT NOT NULL CHECK(json_valid(input_json)),
  assertions_json TEXT NOT NULL DEFAULT '[]' CHECK(json_valid(assertions_json)),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE clients (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  kind TEXT NOT NULL CHECK(kind IN ('api','mcp','pi')),
  token_hash TEXT NOT NULL UNIQUE,
  token_prefix TEXT NOT NULL,
  created_at TEXT NOT NULL,
  revoked_at TEXT,
  last_seen_at TEXT
);

CREATE TABLE client_grants (
  client_id TEXT NOT NULL REFERENCES clients(id),
  function_id TEXT NOT NULL REFERENCES functions(id),
  -- NULL means the client may choose a published version or omit it to follow active_version.
  -- The default UI grant pins an exact version.
  pinned_version INTEGER,
  PRIMARY KEY(client_id, function_id),
  FOREIGN KEY(function_id, pinned_version) REFERENCES releases(function_id, version)
);

CREATE TABLE runs (
  request_id TEXT PRIMARY KEY,
  function_id TEXT REFERENCES functions(id),
  version INTEGER,
  draft_revision INTEGER,
  config_checksum TEXT,
  client_id TEXT REFERENCES clients(id),
  source TEXT NOT NULL CHECK(source IN ('preview','api','mcp','pi','test')),
  execution_status TEXT NOT NULL CHECK(execution_status IN ('running','succeeded','failed','cancelled','interrupted')),
  business_status TEXT CHECK(business_status IN ('ok','needs_review')),
  requested_model TEXT,
  resolved_model TEXT,
  provider_attempts INTEGER NOT NULL DEFAULT 0,
  input_tokens INTEGER,
  output_tokens INTEGER,
  duration_ms INTEGER,
  provider_duration_ms INTEGER,
  error_code TEXT,
  review_rule_ids_json TEXT NOT NULL DEFAULT '[]' CHECK(json_valid(review_rule_ids_json)),
  diagnostic_meta_json TEXT NOT NULL DEFAULT '{}' CHECK(json_valid(diagnostic_meta_json)),
  started_at TEXT NOT NULL,
  finished_at TEXT,
  FOREIGN KEY(function_id, version) REFERENCES releases(function_id, version)
);
CREATE INDEX runs_function_time ON runs(function_id, started_at DESC);
CREATE INDEX runs_client_time ON runs(client_id, started_at DESC);

CREATE TABLE installations (
  id TEXT PRIMARY KEY,
  runtime TEXT NOT NULL CHECK(runtime IN ('claude_code','codex','opencode','pi')),
  scope TEXT NOT NULL CHECK(scope IN ('user','project')),
  client_id TEXT NOT NULL REFERENCES clients(id),
  config_path TEXT NOT NULL,
  config_file_checksum TEXT,
  owned_entry_checksum TEXT,
  backup_path TEXT,
  status TEXT NOT NULL CHECK(status IN ('planned','configured','conflict','removed')),
  last_test_at TEXT,
  last_test_status TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE app_settings (
  setting_key TEXT PRIMARY KEY,
  value_json TEXT NOT NULL CHECK(json_valid(value_json)),
  updated_at TEXT NOT NULL
);

CREATE TABLE audit_events (
  id TEXT PRIMARY KEY,
  action TEXT NOT NULL,
  resource_type TEXT NOT NULL,
  resource_id TEXT NOT NULL,
  detail_json TEXT NOT NULL DEFAULT '{}' CHECK(json_valid(detail_json)),
  created_at TEXT NOT NULL
);

-- No raw request/response payload table in v1. Preview payloads are returned to the
-- current browser session only. Saved test cases are explicit, user-selected content.
