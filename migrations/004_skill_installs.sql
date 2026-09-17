CREATE TABLE skill_installs (
  id TEXT PRIMARY KEY,
  runtime TEXT NOT NULL CHECK(runtime IN ('claude_code','codex','opencode','pi')),
  scope TEXT NOT NULL CHECK(scope IN ('user','project')),
  project TEXT,
  status TEXT NOT NULL CHECK(status IN ('planned','configured','removed')),
  command_json TEXT NOT NULL CHECK(json_valid(command_json)),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
