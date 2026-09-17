import { englishError } from "./localization";
import Fastify from "fastify";
import cookie from "@fastify/cookie";
import serveStatic from "@fastify/static";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { z } from "zod";
import { openDatabase, now } from "./storage";
import { Sessions, SecretStore } from "./security";
import { TypeSafeProvider, type Provider } from "./provider";
import { Functions } from "./functions";
import { Clients } from "./clients";
import { Invoker } from "./invoke";
import { AppError, fail } from "./errors";
import { validateConfig, readPointer } from "./engine";
import {
  invokeBody,
  officialBody,
} from "../../../packages/contracts/src/config";
import { randomUUID } from "node:crypto";
import { Integrations } from "./integrations";
import { Skills } from "./skills";
const grants = z.array(
  z
    .object({
      function_id: z.string(),
      pinned_version: z.number().int().positive().nullable(),
    })
    .strict(),
);
export async function createApp(options: {
  home: string;
  port?: number;
  provider?: Provider;
  testMode?: boolean;
  demoMode?: boolean;
  instance?: string;
  controlToken?: string;
  shutdown?: () => void;
}) {
  if (options.provider?.fixture && !options.testMode && !options.demoMode)
    throw new Error("Fixture provider requires explicit test mode");
  const port = options.port ?? 17420,
    origin = `http://127.0.0.1:${port}`;
  const app = Fastify({
    logger: false,
    bodyLimit: 256 * 1024,
    requestIdHeader: false,
    genReqId: () => randomUUID(),
  });
  const db = openDatabase(options.home),
    sessions = new Sessions(),
    secrets = new SecretStore(options.home),
    provider = options.provider ?? new TypeSafeProvider(secrets),
    functions = new Functions(db, !!provider.fixture),
    clients = new Clients(db),
    invoker = new Invoker(db, provider);
  const integrations = new Integrations(options.home, clients, db, origin),
    skills = new Skills(db);
  await app.register(cookie);
  app.setErrorHandler((e: any, req, reply) => {
    const known = e instanceof AppError;
    const parse = e instanceof z.ZodError;
    const status = known
      ? e.status
      : parse
        ? 400
        : e.statusCode === 413
          ? 413
          : 400 === e.statusCode
            ? 400
            : 500;
    const code = known
      ? e.code
      : status === 413
        ? "INPUT_TOO_LARGE"
        : status === 400
          ? "BAD_REQUEST"
          : "INTERNAL_ERROR";
    reply.code(status).send({
      error: {
        code: known
          ? e.code
          : parse
            ? "BAD_REQUEST"
            : status === 413
              ? "INPUT_TOO_LARGE"
              : status === 400
                ? "BAD_REQUEST"
                : "INTERNAL_ERROR",
        message: req.headers["accept-language"]?.startsWith("en")
          ? englishError(code)
          : known
            ? e.message
            : parse
              ? "请求字段无效"
              : status === 413
                ? "请求超过 256 KiB"
                : status === 400
                  ? "请求格式无效"
                  : "本机处理失败，请检查服务状态",
        fields: known ? e.fields : parse ? e.issues : undefined,
      },
      meta: { request_id: known ? (e.requestId ?? req.id) : req.id },
    });
  });
  app.addHook("onRequest", async (req, reply) => {
    if (req.headers.host !== `127.0.0.1:${port}`)
      fail(403, "HOST_FORBIDDEN", "只接受配置的本机地址");
    if (req.headers.origin && req.headers.origin !== origin)
      fail(403, "ORIGIN_FORBIDDEN", "不接受外部网页请求");
    reply
      .header("X-Content-Type-Options", "nosniff")
      .header("Referrer-Policy", "no-referrer")
      .header("Cache-Control", "no-store");
    if (
      req.url.startsWith("/api/admin/") &&
      !req.url.startsWith("/api/admin/bootstrap")
    ) {
      const s = sessions.get(req.cookies.jev_session);
      if (
        !["GET", "HEAD"].includes(req.method) &&
        req.headers["x-csrf-token"] !== s.csrf
      )
        fail(403, "CSRF_INVALID", "管理会话验证失败，请重新打开页面");
    }
  });
  app.get("/health/live", async () => ({ ok: true }));
  app.get("/internal/instance", async (req) => {
    if (
      req.headers.authorization !== `Bearer ${options.controlToken}` ||
      !options.controlToken
    )
      fail(403, "FORBIDDEN", "禁止访问");
    return { instance: options.instance, pid: process.pid };
  });
  app.post("/internal/open", async (req) => {
    if (
      req.headers.authorization !== `Bearer ${options.controlToken}` ||
      !options.controlToken
    )
      fail(403, "FORBIDDEN", "禁止访问");
    return { url: origin + "/#bootstrap=" + sessions.bootstrap() };
  });
  app.post("/internal/stop", async (req) => {
    if (
      req.headers.authorization !== `Bearer ${options.controlToken}` ||
      !options.controlToken
    )
      fail(403, "FORBIDDEN", "禁止访问");
    setTimeout(() => options.shutdown?.(), 100);
    return { ok: true };
  });
  app.post("/api/admin/bootstrap", async (req, reply) => {
    const b = z.object({ token: z.string() }).strict().parse(req.body);
    const s = sessions.consume(b.token);
    reply.setCookie("jev_session", s.session, {
      httpOnly: true,
      sameSite: "strict",
      path: "/",
      maxAge: 43200,
    });
    return { csrf: s.csrf };
  });
  app.get("/api/admin/status", async (req) => ({
    csrf: sessions.get(req.cookies.jev_session).csrf,
    provider: options.demoMode
      ? { configured: true, source: "demo", masked: "离线演示" }
      : secrets.status(),
    demo_mode: !!options.demoMode,
    test_mode: !!options.testMode,
    fixture: !!provider.fixture,
    port,
    home: options.home,
    timeout_ms: invoker.timeout,
    concurrency: invoker.gate.limit,
    model_test:
      (
        db
          .prepare(
            "SELECT value_json FROM app_settings WHERE setting_key='model_test'",
          )
          .get() as any
      )?.value_json ?? null,
  }));
  app.get("/api/admin/functions", async () => functions.list());
  app.post("/api/admin/functions", async (req) => functions.create(req.body));
  app.get("/api/admin/functions/:id", async (req) =>
    functions.get((req.params as any).id),
  );
  app.put("/api/admin/functions/:id/draft", async (req) =>
    functions.save((req.params as any).id, req.body, req.headers["if-match"]),
  );
  app.delete("/api/admin/functions/:id", async (req) =>
    functions.delete((req.params as any).id),
  );
  app.patch("/api/admin/functions/:id", async (req) => {
    const id = (req.params as any).id;
    functions.get(id);
    const b = z
      .object({
        display_name: z.string().min(1).optional(),
        enabled: z.boolean().optional(),
        archived: z.boolean().optional(),
        trashed: z.boolean().optional(),
      })
      .strict()
      .parse(req.body);
    if (b.display_name !== undefined)
      db.prepare("UPDATE functions SET display_name=? WHERE id=?").run(
        b.display_name,
        id,
      );
    if (b.enabled !== undefined)
      db.prepare("UPDATE functions SET enabled=? WHERE id=?").run(
        Number(b.enabled),
        id,
      );
    if (b.archived !== undefined)
      db.prepare("UPDATE functions SET archived_at=? WHERE id=?").run(
        b.archived ? now() : null,
        id,
      );
    if (b.trashed !== undefined)
      db.prepare(
        "UPDATE functions SET deleted_at=?,updated_at=? WHERE id=?",
      ).run(b.trashed ? now() : null, now(), id);
    return functions.get(id);
  });
  const signalFor = (req: any, reply: any) => {
    const c = new AbortController();
    reply.raw.on("close", () => {
      if (!reply.raw.writableEnded) c.abort();
    });
    req.raw.on("aborted", () => c.abort());
    return c.signal;
  };
  app.post("/api/admin/functions/:id/preview", async (req, reply) => {
    const id = (req.params as any).id,
      f = functions.get(id),
      b = z
        .object({ config: z.unknown(), input: z.record(z.unknown()) })
        .strict()
        .parse(req.body),
      c = validateConfig(b.config);
    if (c.key !== f.function_key)
      fail(422, "CONFIG_INVALID", "先保存修改后的 Key");
    return invoker.run(
      c,
      b.input,
      { function_id: id, draft_revision: f.draft_revision, source: "preview" },
      signalFor(req, reply),
    );
  });
  app.post("/api/admin/functions/:id/publish", async (req) =>
    functions.publish(
      (req.params as any).id,
      z
        .object({
          draft_revision: z.number().int(),
          checksum: z.string(),
          activate: z.boolean().optional(),
          note: z.string().max(2000).optional(),
        })
        .strict()
        .parse(req.body),
    ),
  );
  app.post("/api/admin/functions/:id/activate", async (req) =>
    functions.activate(
      (req.params as any).id,
      z
        .object({ version: z.number().int().positive() })
        .strict()
        .parse(req.body).version,
    ),
  );
  app.get("/api/admin/functions/:id/test-cases", async (req) => {
    functions.get((req.params as any).id);
    return (
      db
        .prepare("SELECT * FROM test_cases WHERE function_id=?")
        .all((req.params as any).id) as any[]
    ).map((t) => ({
      ...t,
      input: JSON.parse(t.input_json),
      assertions: JSON.parse(t.assertions_json),
    }));
  });
  app.post("/api/admin/functions/:id/test-cases", async (req) => {
    const fid = (req.params as any).id;
    functions.get(fid);
    const b = z
        .object({
          name: z.string().min(1),
          input: z.record(z.unknown()),
          assertions: z
            .array(
              z
                .object({
                  path: z.string().startsWith("/"),
                  equals: z.unknown(),
                })
                .strict(),
            )
            .default([]),
        })
        .strict()
        .parse(req.body),
      id = randomUUID();
    db.prepare("INSERT INTO test_cases VALUES(?,?,?,?,?,?,?)").run(
      id,
      fid,
      b.name,
      JSON.stringify(b.input),
      JSON.stringify(b.assertions),
      now(),
      now(),
    );
    return { id };
  });
  app.delete("/api/admin/functions/:id/test-cases/:caseId", async (req) => {
    const p = req.params as any;
    db.prepare("DELETE FROM test_cases WHERE id=? AND function_id=?").run(
      p.caseId,
      p.id,
    );
    return { ok: true };
  });
  app.post("/api/admin/functions/:id/test", async (req, reply) => {
    const id = (req.params as any).id,
      f = functions.get(id),
      b = z
        .object({ version: z.number().int().positive().optional() })
        .strict()
        .parse(req.body ?? {});
    const rel = b.version
      ? f.releases.find((r: any) => r.version === b.version)
      : undefined;
    if (b.version && !rel) fail(404, "VERSION_NOT_FOUND", "版本不存在");
    const results = [];
    for (const t of db
      .prepare("SELECT * FROM test_cases WHERE function_id=?")
      .all(id) as any[]) {
      try {
        const result = await invoker.run(
          rel?.config ?? f.draft,
          JSON.parse(t.input_json),
          { function_id: id, version: b.version, source: "test" },
          signalFor(req, reply),
        );
        const assertions = JSON.parse(t.assertions_json).map((a: any) => ({
          ...a,
          passed:
            JSON.stringify(readPointer(result, a.path)) ===
            JSON.stringify(a.equals),
        }));
        results.push({
          id: t.id,
          name: t.name,
          passed: assertions.every((a: any) => a.passed),
          assertions,
          result,
        });
      } catch (e) {
        results.push({
          id: t.id,
          name: t.name,
          passed: false,
          error: e instanceof AppError ? e.code : "TEST_FAILED",
        });
      }
    }
    return results;
  });
  app.get("/api/admin/runs", async (req) => {
    const q = z
      .object({
        function_id: z.string().optional(),
        source: z.enum(["api", "mcp", "pi", "test", "preview"]).optional(),
        status: z
          .enum(["running", "succeeded", "failed", "cancelled", "interrupted"])
          .optional(),
        offset: z.coerce.number().int().nonnegative().default(0),
      })
      .parse(req.query);
    return db
      .prepare(
        "SELECT * FROM runs WHERE (? IS NULL OR function_id=?) AND (? IS NULL OR source=?) AND (? IS NULL OR execution_status=?) ORDER BY started_at DESC LIMIT 50 OFFSET ?",
      )
      .all(
        q.function_id ?? null,
        q.function_id ?? null,
        q.source ?? null,
        q.source ?? null,
        q.status ?? null,
        q.status ?? null,
        q.offset,
      );
  });
  app.get("/api/admin/clients", async () => clients.list());
  app.post("/api/admin/clients", async (req) => {
    const b = z
      .object({
        name: z.string().min(1),
        kind: z.enum(["api", "mcp", "pi"]),
        grants,
        official_invoke: z.boolean().optional(),
      })
      .strict()
      .parse(req.body);
    return clients.create(
      b.name,
      b.kind,
      b.grants,
      b.official_invoke ?? false,
    );
  });
  app.patch("/api/admin/clients/:id", async (req) => {
    const b = z
      .object({
        name: z.string().min(1),
        grants,
        official_invoke: z.boolean().optional(),
      })
      .strict()
      .parse(req.body);
    return clients.update(
      (req.params as any).id,
      b.name,
      b.grants,
      b.official_invoke,
    );
  });
  app.post("/api/admin/clients/:id/revoke", async (req) =>
    clients.revoke((req.params as any).id),
  );
  app.put("/api/admin/provider", async (req) => {
    if (options.demoMode)
      fail(409, "DEMO_MODE", "演示服务不保存供应商密钥。请在正式服务配置 Key");
    const b = z
      .object({ key: z.string().min(1).max(4096) })
      .strict()
      .parse(req.body);
    secrets.save(b.key);
    return secrets.status();
  });
  app.post("/api/admin/provider/test", async () => {
    const result = await provider.models();
    db.prepare(
      "INSERT INTO app_settings VALUES('model_test',?,?) ON CONFLICT(setting_key) DO UPDATE SET value_json=excluded.value_json,updated_at=excluded.updated_at",
    ).run(JSON.stringify({ at: now(), result }), now());
    return result;
  });
  app.patch("/api/admin/settings", async (req) => {
    const b = z
      .object({
        timeout_ms: z.number().int().min(1000).max(30000),
        concurrency: z.number().int().min(1).max(4),
      })
      .strict()
      .parse(req.body);
    invoker.timeout = b.timeout_ms;
    invoker.gate.limit = b.concurrency;
    db.prepare(
      "INSERT INTO app_settings VALUES('execution',?,?) ON CONFLICT(setting_key) DO UPDATE SET value_json=excluded.value_json,updated_at=excluded.updated_at",
    ).run(JSON.stringify(b), now());
    return b;
  });
  const settings = db
    .prepare(
      "SELECT value_json FROM app_settings WHERE setting_key='execution'",
    )
    .get() as any;
  if (settings) {
    const s = JSON.parse(settings.value_json);
    invoker.timeout = s.timeout_ms;
    invoker.gate.limit = s.concurrency;
  }
  app.get("/api/admin/export", async () => ({
    format_version: 1,
    functions: (functions.list() as any[]).map((f) => {
      const full = functions.get(f.id);
      return {
        draft: full.draft,
        releases: full.releases.map((r: any) => ({
          version: r.version,
          config: r.config,
        })),
        active_version: full.active_version,
      };
    }),
  }));
  app.post("/api/admin/backup", async () => {
    const path = join(options.home, "backups", `workbench-${Date.now()}.db`);
    await db.backup(path);
    const { chmodSync } = await import("node:fs");
    chmodSync(path, 0o600);
    return { path };
  });
  app.get("/v1/functions", async (req) =>
    clients.visible(clients.authenticate(req.headers.authorization)),
  );
  app.get("/v1/functions/:key", async (req) => {
    const q = z
      .object({ version: z.coerce.number().int().positive().optional() })
      .strict()
      .parse(req.query);
    return clients.describe(
      clients.authenticate(req.headers.authorization),
      (req.params as any).key,
      q.version,
    );
  });
  app.post("/v1/functions/:key/invoke", async (req, reply) => {
    const client = clients.authenticate(req.headers.authorization),
      b = invokeBody.parse(req.body),
      r = clients.resolve(client, (req.params as any).key, b.version);
    return invoker.run(
      r.config,
      b.input,
      {
        function_id: r.function_id,
        version: r.version,
        source: client.kind,
        client_id: client.id,
      },
      signalFor(req, reply),
    );
  });
  const officialClient = (req: any) => {
    const client = clients.authenticate(req.headers.authorization);
    if (options.demoMode)
      fail(409, "DEMO_MODE", "演示服务不转发官方 Jev 接口。请使用正式服务");
    return clients.requireOfficial(client);
  };
  app.get("/v1/models", async (req) => {
    officialClient(req);
    return provider.models();
  });
  app.post("/v1/systemone", async (req, reply) => {
    const client = officialClient(req),
      body = officialBody.parse(req.body),
      r = await invoker.official(
        body,
        { client_id: client.id, source: client.kind },
        signalFor(req, reply),
      );
    reply.header("x-request-id", r.requestId);
    return r.response;
  });
  app.post("/api/admin/integrations/detect", async () => integrations.detect());
  app.get("/api/admin/integrations", async () => integrations.list());
  app.post("/api/admin/integrations/plan", async (req) =>
    integrations.plan(
      z
        .object({
          runtime: z.enum(["claude_code", "codex", "opencode", "pi"]),
          scope: z.enum(["user", "project"]),
          project: z.string().optional(),
          grants,
        })
        .strict()
        .parse(req.body),
    ),
  );
  app.post("/api/admin/integrations/apply", async (req) =>
    integrations.apply(
      z.object({ plan_id: z.string() }).strict().parse(req.body).plan_id,
    ),
  );
  app.post("/api/admin/integrations/:id/test", async (req) =>
    integrations.test((req.params as any).id),
  );
  app.post("/api/admin/integrations/:id/remove", async (req) =>
    integrations.remove((req.params as any).id),
  );
  app.get("/api/admin/skills", async () => skills.list());
  app.post("/api/admin/skills/plan", async (req) =>
    skills.plan(
      z
        .object({
          runtime: z.enum(["claude_code", "codex", "opencode", "pi"]),
          scope: z.enum(["user", "project"]),
          project: z.string().optional(),
          skill: z.enum(["jev-workbench", "typesafe-ai"]),
        })
        .strict()
        .parse(req.body),
    ),
  );
  app.post("/api/admin/skills/apply", async (req) =>
    skills.apply(
      z.object({ plan_id: z.string() }).strict().parse(req.body).plan_id,
    ),
  );
  app.post("/api/admin/skills/:id/remove", async (req) =>
    skills.remove((req.params as any).id),
  );
  const root = join(process.cwd(), "dist/web");
  if (existsSync(root)) {
    await app.register(serveStatic, { root });
    app.setNotFoundHandler((req, reply) =>
      req.url.startsWith("/api/") || req.url.startsWith("/v1/")
        ? reply
            .code(404)
            .send({ error: { code: "NOT_FOUND", message: "接口不存在" } })
        : reply.sendFile("index.html"),
    );
  }
  app.addHook("onClose", async () => {
    invoker.cancelAll();
    db.close();
  });
  return {
    app,
    db,
    sessions,
    origin,
    functions,
    clients,
    invoker,
    integrations,
    skills,
  };
}
