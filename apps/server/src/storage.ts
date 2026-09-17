import Database from "better-sqlite3";
import { mkdirSync, readFileSync, chmodSync } from "node:fs";
import { join } from "node:path";
import { randomUUID } from "node:crypto";
export const now = () => new Date().toISOString();
export function openDatabase(home: string) {
  for (const p of ["", "data", "clients", "backups", "logs", "runtime"]) {
    mkdirSync(join(home, p), { recursive: true, mode: 0o700 });
    chmodSync(join(home, p), 0o700);
  }
  const db = new Database(join(home, "data/workbench.db"));
  chmodSync(join(home, "data/workbench.db"), 0o600);
  db.pragma("foreign_keys = ON");
  db.pragma("journal_mode = WAL");
  db.pragma("synchronous = FULL");
  db.pragma("busy_timeout = 5000");
  db.exec(
    "CREATE TABLE IF NOT EXISTS schema_migrations(version INTEGER PRIMARY KEY, applied_at TEXT NOT NULL)",
  );
  if (!db.prepare("SELECT 1 FROM schema_migrations WHERE version=1").get()) {
    db.transaction(() => {
      db.exec(
        readFileSync(
          join(process.cwd(), "migrations/001_initial.sql"),
          "utf8",
        ).replace(/PRAGMA[^;]+;/g, ""),
      );
      db.prepare("INSERT INTO schema_migrations VALUES(1,?)").run(now());
    })();
  }
  if (!db.prepare("SELECT 1 FROM schema_migrations WHERE version=2").get()) {
    db.transaction(() => {
      db.exec(
        readFileSync(
          join(process.cwd(), "migrations/002_function_trash.sql"),
          "utf8",
        ),
      );
      db.prepare("INSERT INTO schema_migrations VALUES(2,?)").run(now());
    })();
  }
  if (!db.prepare("SELECT 1 FROM schema_migrations WHERE version=3").get()) {
    db.transaction(() => {
      db.exec(
        readFileSync(
          join(process.cwd(), "migrations/003_official_invoke.sql"),
          "utf8",
        ),
      );
      db.prepare("INSERT INTO schema_migrations VALUES(3,?)").run(now());
    })();
  }
  if (!db.prepare("SELECT 1 FROM schema_migrations WHERE version=4").get()) {
    db.transaction(() => {
      db.exec(
        readFileSync(
          join(process.cwd(), "migrations/004_skill_installs.sql"),
          "utf8",
        ),
      );
      db.prepare("INSERT INTO schema_migrations VALUES(4,?)").run(now());
    })();
  }
  db.prepare(
    "UPDATE runs SET execution_status='interrupted',finished_at=? WHERE execution_status='running'",
  ).run(now());
  return db;
}
export type DB = ReturnType<typeof openDatabase>;
export function audit(
  db: DB,
  action: string,
  resource: string,
  id: string,
  detail: unknown = {},
) {
  db.prepare("INSERT INTO audit_events VALUES(?,?,?,?,?,?)").run(
    randomUUID(),
    action,
    resource,
    id,
    JSON.stringify(detail),
    now(),
  );
}
