import { randomUUID } from "node:crypto";
import { validateConfig, checksum } from "./engine";
import { fixedModel } from "../../../packages/contracts/src/config";
import { fail } from "./errors";
import { type DB, now, audit } from "./storage";
export class Functions {
  constructor(
    public db: DB,
    private fixture = false,
  ) {}
  list() {
    const rows = this.db
      .prepare(
        "SELECT id,function_key,display_name,description,draft_json,draft_revision,active_version,enabled,archived_at,deleted_at,updated_at FROM functions ORDER BY updated_at DESC",
      )
      .all() as any[];
    return rows.map((f) => ({
      ...f,
      draft_json: undefined,
      primitives: [
        ...new Set(
          Object.values(JSON.parse(f.draft_json).questions).map(
            (q: any) => q.type,
          ),
        ),
      ],
      versions: (
        this.db
          .prepare(
            "SELECT version FROM releases WHERE function_id=? ORDER BY version DESC",
          )
          .all(f.id) as { version: number }[]
      ).map((r) => r.version),
      last_run:
        this.db
          .prepare(
            "SELECT execution_status,business_status,started_at FROM runs WHERE function_id=? ORDER BY started_at DESC LIMIT 1",
          )
          .get(f.id) ?? null,
    }));
  }

  delete(id: string) {
    return this.db.transaction(() => {
      const f = this.get(id);
      if (!f.deleted_at)
        fail(409, "TRASH_REQUIRED", "请先移入回收站，再永久删除");
      if (
        this.db
          .prepare(
            "SELECT 1 FROM runs WHERE function_id=? AND execution_status='running'",
          )
          .get(id)
      )
        fail(409, "FUNCTION_BUSY", "函数正在执行，请结束后再删除");
      this.db.prepare("DELETE FROM client_grants WHERE function_id=?").run(id);
      this.db.prepare("DELETE FROM test_cases WHERE function_id=?").run(id);
      this.db.prepare("DELETE FROM runs WHERE function_id=?").run(id);
      this.db
        .prepare("UPDATE functions SET active_version=NULL WHERE id=?")
        .run(id);
      this.db.prepare("DELETE FROM releases WHERE function_id=?").run(id);
      this.db.prepare("DELETE FROM functions WHERE id=?").run(id);
      audit(this.db, "function.delete", "function", id, {});
      return { deleted: true };
    })();
  }

  get(id: string) {
    const row = this.db
      .prepare("SELECT * FROM functions WHERE id=?")
      .get(id) as any;
    if (!row) fail(404, "FUNCTION_NOT_FOUND", "判断函数不存在");
    return {
      ...row,
      draft: JSON.parse(row.draft_json),
      checksum: checksum(JSON.parse(row.draft_json)),
      releases: (
        this.db
          .prepare(
            "SELECT * FROM releases WHERE function_id=? ORDER BY version DESC",
          )
          .all(id) as any[]
      ).map((r) => ({ ...r, config: JSON.parse(r.config_json) })),
      grants: this.db
        .prepare(
          "SELECT client_id,pinned_version,name FROM client_grants JOIN clients ON clients.id=client_id WHERE function_id=? AND revoked_at IS NULL",
        )
        .all(id),
      draft_json: undefined,
    };
  }
  create(raw: unknown) {
    const c = validateConfig(raw),
      id = randomUUID();
    if (
      this.db.prepare("SELECT 1 FROM functions WHERE function_key=?").get(c.key)
    )
      fail(409, "KEY_EXISTS", "此函数 Key 已存在");
    this.db
      .prepare(
        "INSERT INTO functions(id,function_key,display_name,description,draft_json,created_at,updated_at) VALUES(?,?,?,?,?,?,?)",
      )
      .run(id, c.key, c.name, c.description, JSON.stringify(c), now(), now());
    return this.get(id);
  }
  save(id: string, raw: unknown, etag: unknown) {
    const c = validateConfig(raw);
    return this.db.transaction(() => {
      const f = this.get(id);
      if (etag !== `"draft-${f.draft_revision}"`)
        fail(
          409,
          "DRAFT_REVISION_CONFLICT",
          "草稿已在其他页面修改。请复制本地编辑或重新载入",
        );
      if (c.key !== f.function_key && f.releases.length)
        fail(422, "CONFIG_INVALID", "发布后的函数 Key 不可更改");
      if (
        this.db
          .prepare("SELECT 1 FROM functions WHERE function_key=? AND id<>?")
          .get(c.key, id)
      )
        fail(409, "KEY_EXISTS", "此函数 Key 已存在");
      this.db
        .prepare(
          "UPDATE functions SET function_key=?,display_name=?,description=?,draft_json=?,draft_revision=draft_revision+1,updated_at=? WHERE id=?",
        )
        .run(c.key, c.name, c.description, JSON.stringify(c), now(), id);
      return this.get(id);
    })();
  }
  publish(
    id: string,
    b: {
      draft_revision: number;
      checksum: string;
      activate?: boolean;
      note?: string;
    },
  ) {
    return this.db
      .transaction(() => {
        const f = this.get(id),
          c = validateConfig(f.draft);
        if (f.draft_revision !== b.draft_revision || f.checksum !== b.checksum)
          fail(
            409,
            "DRAFT_REVISION_CONFLICT",
            "保存的草稿已改变，请刷新发布预览",
          );
        if (!fixedModel(c.model))
          fail(422, "CONFIG_INVALID", "发布必须固定模型版本，例如 jev-1.13.0");
        const proof = this.db
          .prepare(
            "SELECT request_id FROM runs WHERE function_id=? AND config_checksum=? AND source='preview' AND execution_status='succeeded' AND resolved_model=? AND diagnostic_meta_json=? LIMIT 1",
          )
          .get(
            id,
            f.checksum,
            c.model,
            JSON.stringify({ fixture: this.fixture }),
          );
        if (!proof)
          fail(422, "PREVIEW_REQUIRED", "请先成功试跑当前完整配置，再发布");
        const v = (f.releases[0]?.version ?? 0) + 1;
        this.db
          .prepare("INSERT INTO releases VALUES(?,?,?,?,?,?)")
          .run(id, v, JSON.stringify(c), f.checksum, b.note ?? "", now());
        if (b.activate !== false)
          this.db
            .prepare(
              "UPDATE functions SET active_version=?,updated_at=? WHERE id=?",
            )
            .run(v, now(), id);
        audit(this.db, "publish", "function", id, { version: v });
        return this.get(id);
      })
      .immediate();
  }
  activate(id: string, version: number) {
    this.get(id);
    if (
      !this.db
        .prepare("SELECT 1 FROM releases WHERE function_id=? AND version=?")
        .get(id, version)
    )
      fail(404, "VERSION_NOT_FOUND", "发布版本不存在");
    this.db
      .prepare("UPDATE functions SET active_version=?,updated_at=? WHERE id=?")
      .run(version, now(), id);
    audit(this.db, "activate", "function", id, { version });
    return this.get(id);
  }
}
