import { it, expect } from "vitest";
import { execFile, spawn } from "node:child_process";
import { promisify } from "node:util";
import { mkdtempSync, readFileSync, rmSync, existsSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { setTimeout as delay } from "node:timers/promises";
import Database from "better-sqlite3";
import template from "../examples/ticket_route.v1.json";
const exec = promisify(execFile);
it("production service starts, rejects duplicate directory/port, reports missing provider, restarts and stops safely", async () => {
  const home = mkdtempSync(join(tmpdir(), "jev-lifecycle-")),
    other = mkdtempSync(join(tmpdir(), "jev-port-")),
    env: NodeJS.ProcessEnv = {
      ...process.env,
      JEV_HOME: home,
      JEV_PORT: "17426",
      JEV_NO_OPEN: "1",
    };
  delete env.TYPESAFE_API_KEY;
  const cli = (action: string) =>
    exec(process.execPath, ["dist/server/cli.js", "service", action], {
      env,
      timeout: 10000,
    });
  const origin = "http://127.0.0.1:17426";
  try {
    expect((await cli("start")).stdout).toContain("已启动");
    const info = JSON.parse(
      readFileSync(join(home, "runtime/instance.json"), "utf8"),
    );
    expect((await cli("start")).stdout).toContain("已在运行");
    expect((await cli("status")).stdout).toContain("运行中");
    await expect(
      exec(process.execPath, ["dist/server/main.js"], { env, timeout: 5000 }),
    ).rejects.toMatchObject({ code: 1 });
    await expect(
      exec(process.execPath, ["dist/server/main.js"], {
        env: { ...env, JEV_HOME: other },
        timeout: 5000,
      }),
    ).rejects.toMatchObject({ code: 1 });
    expect(
      (
        await fetch(origin + "/internal/stop", {
          method: "POST",
          headers: { Authorization: "Bearer wrong-instance" },
        })
      ).status,
    ).toBe(403);
    const open = await fetch(origin + "/internal/open", {
      method: "POST",
      headers: { Authorization: "Bearer " + info.controlToken },
    }).then((r) => r.json());
    const token = new URL(open.url).hash.slice("#bootstrap=".length);
    const boot = await fetch(origin + "/api/admin/bootstrap", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token }),
    });
    const headers = {
      "Content-Type": "application/json",
      cookie: boot.headers.get("set-cookie")!.split(";")[0],
      "x-csrf-token": (await boot.json()).csrf,
    };
    const f = await fetch(origin + "/api/admin/functions", {
      method: "POST",
      headers,
      body: JSON.stringify(template),
    }).then((r) => r.json());
    const preview = await fetch(
      origin + `/api/admin/functions/${f.id}/preview`,
      {
        method: "POST",
        headers,
        body: JSON.stringify({
          config: template,
          input: { content: "private-test-text" },
        }),
      },
    );
    expect(preview.status).toBe(503);
    expect((await preview.json()).error.code).toBe("PROVIDER_NOT_CONFIGURED");
    await cli("stop");
    const db = new Database(join(home, "data/workbench.db"));
    db.prepare("UPDATE runs SET execution_status='running'").run();
    db.close();
    await cli("start");
    const restarted = new Database(join(home, "data/workbench.db"), {
      readonly: true,
    });
    expect(
      (restarted.prepare("SELECT execution_status FROM runs").get() as any)
        .execution_status,
    ).toBe("interrupted");
    expect(
      (restarted.prepare("SELECT function_key FROM functions").get() as any)
        .function_key,
    ).toBe("ticket_route");
    restarted.close();
    expect(
      (await fetch(origin + "/api/admin/status", { headers })).status,
    ).toBe(401);
    const logs = readFileSync(join(home, "logs/server.log"), "utf8");
    expect(logs).not.toContain(token);
    expect(logs).not.toContain("private-test-text");
    await cli("stop");
    await expect(fetch(origin + "/health/live")).rejects.toThrow();
    expect(existsSync(join(home, "runtime/lock"))).toBe(false);
  } finally {
    try {
      await cli("stop");
    } catch {}
    rmSync(home, { recursive: true, force: true });
    rmSync(other, { recursive: true, force: true });
  }
}, 30000);
