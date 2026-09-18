CREATE TABLE installations_new (
  id TEXT PRIMARY KEY,
  runtime TEXT NOT NULL CHECK(runtime IN ('claude_code','codex','opencode','pi','gemini','grok_build','hermes','minimax_code','openclaw')),
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
INSERT INTO installations_new SELECT * FROM installations;
DROP TABLE installations;
ALTER TABLE installations_new RENAME TO installations;

CREATE TABLE skill_installs_new (
  id TEXT PRIMARY KEY,
  runtime TEXT NOT NULL CHECK(runtime IN ('claude_code','codex','opencode','pi','gemini','grok_build','hermes','minimax_code','openclaw')),
  scope TEXT NOT NULL CHECK(scope IN ('user','project')),
  project TEXT,
  status TEXT NOT NULL CHECK(status IN ('planned','configured','removed')),
  command_json TEXT NOT NULL CHECK(json_valid(command_json)),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  skill_name TEXT NOT NULL DEFAULT 'typesafe-ai'
);
INSERT INTO skill_installs_new SELECT id,runtime,scope,project,status,command_json,created_at,updated_at,skill_name FROM skill_installs;
DROP TABLE skill_installs;
ALTER TABLE skill_installs_new RENAME TO skill_installs;
