import { afterEach, describe, it, expect } from "vitest";
import { mkdtempSync, rmSync, readFileSync, statSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createApp } from "../apps/server/src/app";
import template from "../examples/ticket_route.v1.json";
import { fixture } from "./fixture";
import { SecretStore } from "../apps/server/src/security";
import { TypeSafeProvider, Gate } from "../apps/server/src/provider";
const resources: Array<{
  s: Awaited<ReturnType<typeof createApp>>;
  home: string;
}> = [];
async function setup(provider = fixture) {
  const home = mkdtempSync(join(tmpdir(), "jev-test-")),
    s = await createApp({ home, port: 17421, provider, testMode: true });
  resources.push({ s, home });
  const boot = await s.app.inject({
    method: "POST",
    url: "/api/admin/bootstrap",
    headers: { host: "127.0.0.1:17421" },
    payload: { token: s.sessions.bootstrap() },
  });
  const headers = {
    host: "127.0.0.1:17421",
    cookie: boot.headers["set-cookie"]!.toString().split(";")[0],
    "x-csrf-token": boot.json().csrf,
  };
  const admin = (url: string, method: any = "GET", payload?: any, extra = {}) =>
    s.app.inject({
      url: "/api/admin" + url,
      method,
      payload,
      headers: { ...headers, ...extra },
    });
  const business = (url: string, token = "", payload?: any) =>
    s.app.inject({
      url,
      method: payload ? "POST" : "GET",
      payload,
      headers: { host: "127.0.0.1:17421", authorization: "Bearer " + token },
    });
  return { s, home, admin, business, headers };
}
afterEach(async () => {
  for (const r of resources.splice(0)) {
    await r.s.app.close();
    rmSync(r.home, { recursive: true, force: true });
  }
});
async function publish(admin: any) {
  const created = await admin("/functions", "POST", template);
  expect(created.statusCode, created.body).toBe(200);
  const f = created.json();
  const preview = await admin(`/functions/${f.id}/preview`, "POST", {
    config: template,
    input: { content: "退款" },
  });
  expect(preview.statusCode, preview.body).toBe(200);
  const p = await admin(`/functions/${f.id}/publish`, "POST", {
    draft_revision: f.draft_revision,
    checksum: f.checksum,
  });
  expect(p.statusCode, p.body).toBe(200);
  return p.json();
}
describe("application boundaries", () => {
  it("bootstrap is one-use and Origin/Host/CSRF enforced", async () => {
    const { s, admin, headers } = await setup();
    expect(
      (
        await s.app.inject({
          url: "/health/live",
          headers: { host: "evil.test" },
        })
      ).statusCode,
    ).toBe(403);
    expect(
      (
        await admin("/status", "GET", undefined, {
          origin: "https://evil.test",
        })
      ).statusCode,
    ).toBe(403);
    expect(
      (await admin("/functions", "POST", template, { "x-csrf-token": "" }))
        .statusCode,
    ).toBe(403);
    const t = s.sessions.bootstrap();
    s.sessions.consume(t);
    expect(() => s.sessions.consume(t)).toThrow();
    expect(
      (
        await s.app.inject({
          url: "/api/admin/status",
          headers: { host: headers.host },
        })
      ).statusCode,
    ).toBe(401);
  });
  it("publishes immutable snapshots, resolves pinned versions and enforces token isolation/revocation", async () => {
    const { s, admin, business } = await setup(),
      f = await publish(admin);
    const cl = (
      await admin("/clients", "POST", {
        name: "service",
        kind: "api",
        grants: [{ function_id: f.id, pinned_version: 1 }],
      })
    ).json();
    const r = await business("/v1/functions/ticket_route/invoke", cl.token, {
      input: { content: "退款" },
    });
    expect(r.statusCode, r.body).toBe(200);
    expect(r.json()).toMatchObject({
      data: { department: "billing" },
      meta: { version: 1 },
    });
    expect(
      (
        await business("/v1/functions/ticket_route/invoke", cl.token, {
          version: 2,
          input: { content: "退款" },
        })
      ).statusCode,
    ).toBe(403);
    expect((await business("/api/admin/status", cl.token)).statusCode).toBe(
      401,
    );
    const changed = structuredClone(template);
    changed.questions.department.instructions = "新版本的规则";
    const saved = (
      await admin(`/functions/${f.id}/draft`, "PUT", changed, {
        "if-match": '"draft-1"',
      })
    ).json();
    expect(saved.draft_revision).toBe(2);
    expect(
      (
        await admin(`/functions/${f.id}/draft`, "PUT", changed, {
          "if-match": '"draft-1"',
        })
      ).statusCode,
    ).toBe(409);
    expect(
      (
        await admin(`/functions/${f.id}/publish`, "POST", {
          draft_revision: 2,
          checksum: saved.checksum,
        })
      ).statusCode,
    ).toBe(422);
    await admin(`/functions/${f.id}/preview`, "POST", {
      config: changed,
      input: { content: "退款" },
    });
    const v2 = await admin(`/functions/${f.id}/publish`, "POST", {
      draft_revision: 2,
      checksum: saved.checksum,
    });
    expect(v2.json().active_version).toBe(2);
    expect(
      (
        await business("/v1/functions/ticket_route/invoke", cl.token, {
          input: { content: "退款" },
        })
      ).json().meta.version,
    ).toBe(1);
    expect(() =>
      s.db.prepare("UPDATE releases SET release_note=?").run("tamper"),
    ).toThrow(/immutable/);
    await admin(`/functions/${f.id}/activate`, "POST", { version: 1 });
    expect((await business("/v1/functions", cl.token)).json()[0].version).toBe(
      1,
    );
    await admin(`/clients/${cl.id}/revoke`, "POST", {});
    expect((await business("/v1/functions", cl.token)).statusCode).toBe(401);
  });
  it("does not leak functions to ungranted clients or body content to run metadata", async () => {
    const { s, admin, business, home } = await setup(),
      f = await publish(admin);
    const cl = (
      await admin("/clients", "POST", { name: "none", kind: "api", grants: [] })
    ).json();
    expect((await business("/v1/functions", cl.token)).json()).toEqual([]);
    expect(
      (await business("/v1/functions/ticket_route", cl.token)).statusCode,
    ).toBe(403);
    const secret = "PRIVATE_BODY_9381";
    await admin(`/functions/${f.id}/preview`, "POST", {
      config: template,
      input: { content: secret },
    });
    expect(
      JSON.stringify(s.db.prepare("SELECT * FROM runs").all()),
    ).not.toContain(secret);
    expect(
      JSON.stringify(s.db.prepare("SELECT * FROM clients").all()),
    ).not.toContain(cl.token);
    const store = new SecretStore(home);
    store.save("sensitive-provider-key");
    expect(store.get()).toBe("sensitive-provider-key");
    expect(readFileSync(join(home, "secrets.json"), "utf8")).not.toContain(
      "sensitive-provider-key",
    );
    expect(statSync(join(home, "master.key")).mode & 0o777).toBe(0o600);
  });
  it("saves explicit cases and validates persisted test assertions", async () => {
    const { admin } = await setup(),
      f = await publish(admin);
    await admin(`/functions/${f.id}/test-cases`, "POST", {
      name: "refund",
      input: { content: "退款" },
      assertions: [{ path: "/data/department", equals: "billing" }],
    });
    const tested = await admin(`/functions/${f.id}/test`, "POST", {});
    expect(tested.json()[0].passed).toBe(true);
    const cases = (await admin(`/functions/${f.id}/test-cases`)).json();
    expect(cases[0].input).toEqual({ content: "退款" });
    await admin(`/functions/${f.id}/test-cases/${cases[0].id}`, "DELETE");
    expect((await admin(`/functions/${f.id}/test-cases`)).json()).toEqual([]);
  });
  it("refuses fixture providers outside explicit test mode", async () => {
    const home = mkdtempSync(join(tmpdir(), "jev-mode-"));
    await expect(createApp({ home, provider: fixture })).rejects.toThrow(
      "test mode",
    );
    rmSync(home, { recursive: true, force: true });
  });
});
describe("provider failure policy", () => {
  it("retries only 429/529 once, authenticates separately, rejects broken JSON", async () => {
    const store = { get: () => "key" } as any;
    let calls = 0;
    for (const status of [429, 529]) {
      calls = 0;
      const provider = new TypeSafeProvider(store, async () => {
        calls++;
        return calls === 1
          ? new Response("{}", { status, headers: { "retry-after": "0" } })
          : Response.json({ model: "jev-1.13.0", answers: {} });
      });
      await provider.evaluate({}, AbortSignal.timeout(2000), () => {});
      expect(calls).toBe(2);
    }
    for (const [response, code] of [
      [new Response("", { status: 401 }), "UPSTREAM_AUTH_FAILED"],
      [new Response("{broken"), "UPSTREAM_INVALID_RESPONSE"],
      [new Response("", { status: 422 }), "UPSTREAM_INPUT_REJECTED"],
    ] as const) {
      const p = new TypeSafeProvider(store, async () => response);
      await expect(
        p.evaluate({}, AbortSignal.timeout(2000), () => {}),
      ).rejects.toMatchObject({ code });
    }
    calls = 0;
    const broken = new TypeSafeProvider(store, async () => {
      calls++;
      throw new Error("disconnect");
    });
    await expect(
      broken.evaluate({}, AbortSignal.timeout(2000), () => {}),
    ).rejects.toMatchObject({ code: "UPSTREAM_UNAVAILABLE" });
    expect(calls).toBe(1);
    const captured: any[] = [];
    const listing = new TypeSafeProvider(store, async (url, init: any) => {
      captured.push({ url, init });
      return Response.json({ models: ["jev-latest"] });
    });
    await listing.models();
    expect(captured[0].url).toBe("https://api.typesafe.ai/v1/models");
    expect(captured[0].init.method).toBe("GET");
    expect(captured[0].init.headers["Content-Type"]).toBeUndefined();
    expect(captured[0].init.headers.Authorization).toBe("Bearer key");
  });
  it("bounded queue rejects overflow and cancellation releases permits", async () => {
    const gate = new Gate(1, 1),
      abort = new AbortController();
    let finish!: () => void;
    const first = gate.run(
      new AbortController().signal,
      () => new Promise<void>((r) => (finish = r)),
    );
    const second = gate.run(abort.signal, async () => 42);
    await expect(
      gate.run(new AbortController().signal, async () => 0),
    ).rejects.toMatchObject({ code: "LOCAL_BUSY" });
    abort.abort();
    await expect(second).rejects.toMatchObject({ code: "UPSTREAM_TIMEOUT" });
    finish();
    await first;
    expect(await gate.run(new AbortController().signal, async () => 7)).toBe(7);
  });
});

describe("function list lifecycle", () => {
  it("archives and restores calls; deletion removes only the target function and its dependent records", async () => {
    const { s, admin, business } = await setup();
    const f = await publish(admin);
    const other = (
      await admin("/functions", "POST", { ...template, key: "untouched" })
    ).json();
    const client = s.clients.create("lifecycle", "api", [
      { function_id: f.id, pinned_version: 1 },
    ]);
    const url = `/v1/functions/${f.function_key}/invoke`;
    expect(
      (
        await business(url, client.token, {
          input: { content: "退款" },
          version: 1,
        })
      ).statusCode,
    ).toBe(200);
    await admin(`/functions/${f.id}`, "PATCH", { archived: true });
    expect(
      (
        await business(url, client.token, {
          input: { content: "退款" },
          version: 1,
        })
      ).json().error.code,
    ).toBe("FUNCTION_DISABLED");
    expect(s.functions.get(f.id).releases).toHaveLength(1);
    await admin(`/functions/${f.id}`, "PATCH", { archived: false });
    expect(
      (
        await business(url, client.token, {
          input: { content: "退款" },
          version: 1,
        })
      ).statusCode,
    ).toBe(200);
    await admin(`/functions/${f.id}/test-cases`, "POST", {
      name: "saved",
      input: { content: "退款" },
      assertions: [],
    });
    expect(
      (
        await admin(`/functions/${f.id}`, "DELETE", undefined, {
          "x-csrf-token": "",
        })
      ).statusCode,
    ).toBe(403);
    expect(
      (await admin(`/functions/${f.id}`, "DELETE")).json().error.code,
    ).toBe("TRASH_REQUIRED");
    await admin(`/functions/${f.id}`, "PATCH", { trashed: true });
    expect(
      (
        await business(url, client.token, {
          input: { content: "退款" },
          version: 1,
        })
      ).json().error.code,
    ).toBe("FUNCTION_DISABLED");
    expect(
      s.clients.visible(s.clients.authenticate("Bearer " + client.token)),
    ).toHaveLength(0);
    expect(s.functions.get(f.id).releases).toHaveLength(1);
    await admin(`/functions/${f.id}`, "PATCH", { trashed: false });
    expect(
      (
        await business(url, client.token, {
          input: { content: "退款" },
          version: 1,
        })
      ).statusCode,
    ).toBe(200);
    await admin(`/functions/${f.id}`, "PATCH", { trashed: true });
    expect((await admin(`/functions/${f.id}`, "DELETE")).statusCode).toBe(200);
    expect((await admin(`/functions/${f.id}`)).statusCode).toBe(404);
    for (const table of ["releases", "client_grants", "runs", "test_cases"])
      expect(
        s.db
          .prepare(`SELECT count(*) AS n FROM ${table} WHERE function_id=?`)
          .get(f.id),
      ).toEqual({ n: 0 });
    expect(s.functions.get(other.id).function_key).toBe("untouched");
    expect(s.clients.list()).toHaveLength(1);
    expect(
      (
        await business(url, client.token, {
          input: { content: "退款" },
          version: 1,
        })
      ).statusCode,
    ).not.toBe(200);
    expect((await admin("/functions")).json()[0].primitives).toEqual([
      "choice",
    ]);
  });
  it("rejects deletion during a real in-flight preview, then allows it after completion", async () => {
    let release!: () => void, entered!: () => void;
    const started = new Promise<void>((r) => (entered = r)),
      waiting = new Promise<void>((r) => (release = r));
    const { admin } = await setup({
      ...fixture,
      async evaluate(...args) {
        entered();
        await waiting;
        return fixture.evaluate(...args);
      },
    });
    const f = (await admin("/functions", "POST", template)).json();
    const preview = admin(`/functions/${f.id}/preview`, "POST", {
      config: template,
      input: { content: "退款" },
    });
    const running = preview.then((r) => r);
    await started;
    await admin(`/functions/${f.id}`, "PATCH", { trashed: true });
    const refused = await admin(`/functions/${f.id}`, "DELETE", undefined, {
      "accept-language": "en",
    });
    expect(refused.statusCode).toBe(409);
    expect(refused.json().error.message).toContain("running");
    release();
    expect((await running).statusCode).toBe(200);
    expect((await admin(`/functions/${f.id}`, "DELETE")).statusCode).toBe(200);
  });
  it("official systemone requires an explicit grant, returns the provider body, and stores no payload", async () => {
    const { s, admin, business } = await setup();
    const body = {
      model: "jev-1.13.0",
      state: "重复扣款请退款",
      questions: {
        is_billing: { type: "noul", instructions: "这是账单问题吗？" },
      },
    };
    const denied = (
      await admin("/clients", "POST", {
        name: "functions-only",
        kind: "api",
        grants: [],
      })
    ).json();
    expect(
      (await business("/v1/systemone", denied.token, body)).statusCode,
    ).toBe(403);
    expect((await business("/v1/models", denied.token)).statusCode).toBe(403);
    const allowed = (
      await admin("/clients", "POST", {
        name: "official",
        kind: "api",
        grants: [],
        official_invoke: true,
      })
    ).json();
    const r = await business("/v1/systemone", allowed.token, body);
    expect(r.statusCode, r.body).toBe(200);
    expect(r.json()).toMatchObject({
      model: "jev-1.13.0",
      answers: { is_billing: { type: "noul" } },
    });
    expect(r.json().status).toBeUndefined();
    expect(r.headers["x-request-id"]).toBeTruthy();
    expect((await business("/v1/models", allowed.token)).json()).toEqual({
      models: ["jev-1.13.0"],
    });
    const row = s.db
      .prepare(
        "SELECT function_id,diagnostic_meta_json,requested_model FROM runs WHERE request_id=?",
      )
      .get(r.headers["x-request-id"]) as any;
    expect(row.function_id).toBeNull();
    expect(JSON.parse(row.diagnostic_meta_json)).toMatchObject({
      official: true,
      fixture: true,
    });
    expect(JSON.stringify(row)).not.toContain("重复扣款请退款");
  });
  it("production official invoke without a key is PROVIDER_NOT_CONFIGURED", async () => {
    const home = mkdtempSync(join(tmpdir(), "jev-official-"));
    const s = await createApp({ home, port: 17421 });
    try {
      const cl = s.clients.create("official", "api", [], true);
      const r = await s.app.inject({
        url: "/v1/systemone",
        method: "POST",
        headers: {
          host: "127.0.0.1:17421",
          authorization: "Bearer " + cl.token,
        },
        payload: {
          model: "jev-1.13.0",
          state: "x",
          questions: { q: { type: "noul", instructions: "x" } },
        },
      });
      expect(r.statusCode).toBe(503);
      expect(r.json().error.code).toBe("PROVIDER_NOT_CONFIGURED");
    } finally {
      await s.app.close();
      rmSync(home, { recursive: true, force: true });
    }
  });
});
