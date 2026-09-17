import { it, expect } from "vitest";
import {
  mkdtempSync,
  mkdirSync,
  writeFileSync,
  readFileSync,
  existsSync,
  rmSync,
} from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { parse } from "jsonc-parser";
import { createApp } from "../apps/server/src/app";
import { fixture } from "./fixture";
it("JSONC install preserves comments/other MCP, rejects preview races, removes only owned entry", async () => {
  const home = mkdtempSync(join(tmpdir(), "jev-install-")),
    project = join(home, "project with spaces");
  mkdirSync(project);
  const path = join(project, "opencode.jsonc");
  writeFileSync(
    path,
    '{\n // keep this comment\n "model":"keep-model",\n "mcp":{"other":{"type":"local","command":["keep"]}}\n}',
  );
  const s = await createApp({
    home,
    port: 17424,
    provider: fixture,
    testMode: true,
  });
  try {
    const p = await s.integrations.plan({
      runtime: "opencode",
      scope: "project",
      project,
      grants: [],
    });
    writeFileSync(path, readFileSync(path, "utf8") + "\n");
    await expect(s.integrations.apply(p.plan_id)).rejects.toMatchObject({
      code: "CONFIG_CHANGED",
    });
    const second = await s.integrations.plan({
      runtime: "opencode",
      scope: "project",
      project,
      grants: [],
    });
    const i = await s.integrations.apply(second.plan_id);
    const installed = readFileSync(path, "utf8");
    expect(installed).toContain("// keep this comment");
    expect(parse(installed).mcp.other.command).toEqual(["keep"]);
    expect(parse(installed).mcp["jev-workbench"].command.at(-1)).toContain(
      home,
    );
    writeFileSync(path, installed.replace("keep-model", "user-new-model"));
    await s.integrations.remove(i.id);
    const removed = readFileSync(path, "utf8");
    expect(parse(removed).model).toBe("user-new-model");
    expect(parse(removed).mcp.other).toBeTruthy();
    expect(parse(removed).mcp["jev-workbench"]).toBeUndefined();
    expect(removed).toContain("// keep this comment");
    expect(await s.integrations.remove(i.id)).toEqual({ ok: true });
    const pi = await s.integrations.plan({
      runtime: "pi",
      scope: "project",
      project,
      grants: [],
    });
    const piInstall = await s.integrations.apply(pi.plan_id);
    expect(existsSync(join(project, ".pi/extensions/jev-workbench.ts"))).toBe(
      true,
    );
    await s.integrations.remove(piInstall.id);
    expect(existsSync(join(project, ".pi/extensions/jev-workbench.ts"))).toBe(
      false,
    );
  } finally {
    await s.app.close();
    rmSync(home, { recursive: true, force: true });
  }
});
