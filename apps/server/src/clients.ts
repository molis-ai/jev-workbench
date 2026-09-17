import { randomUUID } from "node:crypto";
import { type DB, now, audit } from "./storage";
import { token, hash } from "./security";
import { fail } from "./errors";
export type Grant = { function_id: string; pinned_version: number | null };
export class Clients {
  constructor(private db: DB) {}
  list() {
    return (
      this.db
        .prepare(
          "SELECT id,name,kind,token_prefix,official_invoke,created_at,revoked_at,last_seen_at FROM clients ORDER BY created_at DESC",
        )
        .all() as any[]
    ).map((c) => ({
      ...c,
      official_invoke: !!c.official_invoke,
      grants: this.db
        .prepare(
          "SELECT function_id,pinned_version,function_key FROM client_grants JOIN functions ON functions.id=function_id WHERE client_id=?",
        )
        .all(c.id),
    }));
  }
  private grant(id: string, grants: Grant[]) {
    for (const g of grants) {
      if (
        !this.db
          .prepare(
            "SELECT 1 FROM functions WHERE id=? AND active_version IS NOT NULL AND deleted_at IS NULL",
          )
          .get(g.function_id)
      )
        fail(422, "CONFIG_INVALID", "只可授权已发布函数");
      if (
        g.pinned_version !== null &&
        !this.db
          .prepare("SELECT 1 FROM releases WHERE function_id=? AND version=?")
          .get(g.function_id, g.pinned_version)
      )
        fail(422, "CONFIG_INVALID", "授权版本不存在");
    }
    this.db.prepare("DELETE FROM client_grants WHERE client_id=?").run(id);
    for (const g of grants)
      this.db
        .prepare("INSERT INTO client_grants VALUES(?,?,?)")
        .run(id, g.function_id, g.pinned_version);
  }
  create(
    name: string,
    kind: string,
    grants: Grant[],
    officialInvoke = false,
  ) {
    return this.db.transaction(() => {
      const t = token(),
        id = randomUUID();
      this.db
        .prepare(
          "INSERT INTO clients(id,name,kind,token_hash,token_prefix,created_at,official_invoke) VALUES(?,?,?,?,?,?,?)",
        )
        .run(
          id,
          name,
          kind,
          hash(t),
          t.slice(0, 8),
          now(),
          Number(officialInvoke),
        );
      this.grant(id, grants);
      audit(this.db, "create", "client", id, {
        official_invoke: !!officialInvoke,
      });
      return { id, token: t };
    })();
  }
  update(
    id: string,
    name: string,
    grants: Grant[],
    officialInvoke?: boolean,
  ) {
    return this.db.transaction(() => {
      if (
        !this.db
          .prepare("SELECT 1 FROM clients WHERE id=? AND revoked_at IS NULL")
          .get(id)
      )
        fail(404, "CLIENT_NOT_FOUND", "客户端不存在或已撤销");
      this.grant(id, grants);
      this.db
        .prepare(
          officialInvoke === undefined
            ? "UPDATE clients SET name=? WHERE id=?"
            : "UPDATE clients SET name=?,official_invoke=? WHERE id=?",
        )
        .run(
          ...(officialInvoke === undefined
            ? [name, id]
            : [name, Number(officialInvoke), id]),
        );
      audit(this.db, "update", "client", id, {
        official_invoke: officialInvoke,
      });
      return { ok: true };
    })();
  }
  requireOfficial(client: any) {
    if (!client.official_invoke)
      fail(
        403,
        "OFFICIAL_INVOKE_FORBIDDEN",
        "当前凭证未授权官方 Jev 调用。请在创建或编辑客户端时勾选该能力。",
      );
    return client;
  }
  revoke(id: string) {
    this.db
      .prepare("UPDATE clients SET revoked_at=? WHERE id=?")
      .run(now(), id);
    audit(this.db, "revoke", "client", id);
    return { ok: true };
  }
  authenticate(auth?: string) {
    const t = auth?.startsWith("Bearer ") ? auth.slice(7) : "";
    const c = this.db
      .prepare(
        "SELECT id,kind,official_invoke FROM clients WHERE token_hash=? AND revoked_at IS NULL",
      )
      .get(hash(t)) as any;
    if (!c) fail(401, "INVALID_CLIENT_TOKEN", "调用凭证缺失、无效或已撤销");
    this.db
      .prepare("UPDATE clients SET last_seen_at=? WHERE id=?")
      .run(now(), c.id);
    return { ...c, official_invoke: !!c.official_invoke };
  }
  resolve(client: any, key: string, version?: number) {
    const g = this.db
      .prepare(
        "SELECT f.*,g.pinned_version FROM client_grants g JOIN functions f ON f.id=g.function_id WHERE g.client_id=? AND f.function_key=?",
      )
      .get(client.id, key) as any;
    if (!g) fail(403, "FUNCTION_FORBIDDEN", "当前客户端未获此函数授权");
    if (!g.enabled || g.archived_at || g.deleted_at)
      fail(503, "FUNCTION_DISABLED", "函数已停用、归档或移入回收站");
    if (
      g.pinned_version !== null &&
      version !== undefined &&
      g.pinned_version !== version
    )
      fail(403, "VERSION_FORBIDDEN", "当前凭证固定在另一版本");
    const v = g.pinned_version ?? version ?? g.active_version;
    const r = this.db
      .prepare("SELECT * FROM releases WHERE function_id=? AND version=?")
      .get(g.id, v) as any;
    if (!r) fail(404, "VERSION_NOT_FOUND", "已发布版本不存在");
    return { ...r, config: JSON.parse(r.config_json), function_key: key };
  }
  describe(client: any, key: string, version?: number) {
    const r = this.resolve(client, key, version),
      c = r.config;
    return {
      key,
      name: c.name,
      description: c.description,
      when_to_use: c.when_to_use,
      version: r.version,
      input_schema: c.input_schema,
      output_schema: c.output_schema,
    };
  }
  visible(client: any) {
    return (
      this.db
        .prepare(
          "SELECT function_key FROM client_grants JOIN functions ON functions.id=function_id WHERE client_id=? AND enabled=1 AND archived_at IS NULL AND deleted_at IS NULL",
        )
        .all(client.id) as any[]
    ).map((f) => this.describe(client, f.function_key));
  }
}
