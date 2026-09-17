import { it, expect } from "vitest";
import Database from "better-sqlite3";
import { mkdtempSync, mkdirSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { openDatabase } from "../apps/server/src/storage";
import { Functions } from "../apps/server/src/functions";
import template from "../examples/ticket_route.v1.json";
it("upgrades a version-1 database without losing an existing function or saved example", () => {
  const home = mkdtempSync(join(tmpdir(), "jev-migration-"));
  mkdirSync(join(home, "data"));
  const old = new Database(join(home, "data/workbench.db"));
  old.exec(readFileSync("migrations/001_initial.sql", "utf8"));
  old
    .prepare("INSERT INTO schema_migrations VALUES(1,?)")
    .run(new Date().toISOString());
  const f = new Functions(old).create(template);
  old
    .prepare("INSERT INTO test_cases VALUES(?,?,?,?,?,?,?)")
    .run(
      "sample",
      f.id,
      "preserved",
      JSON.stringify({ content: "退款" }),
      "[]",
      "2026-09-18",
      "2026-09-18",
    );
  old.close();
  const db = openDatabase(home);
  try {
    const restored = new Functions(db).get(f.id);
    expect(restored.draft).toEqual(template);
    expect(restored.deleted_at).toBeNull();
    expect(
      db.prepare("SELECT input_json FROM test_cases WHERE id=?").get("sample"),
    ).toEqual({ input_json: '{"content":"退款"}' });
    db.prepare("UPDATE functions SET deleted_at=? WHERE id=?").run(
      "2026-09-18",
      f.id,
    );
    expect(new Functions(db).get(f.id).deleted_at).toBe("2026-09-18");
    expect(
      db
        .prepare("SELECT official_invoke FROM clients")
        .all()
        .every((c: any) => c.official_invoke === 0),
    ).toBe(true);
    expect(
      db
        .prepare("SELECT 1 FROM schema_migrations WHERE version=3")
        .get(),
    ).toBeTruthy();
  } finally {
    db.close();
    rmSync(home, { recursive: true, force: true });
  }
});
