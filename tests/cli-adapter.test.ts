import { it, expect } from "vitest";
import { execFileSync } from "node:child_process";
import {
  mkdtempSync,
  mkdirSync,
  writeFileSync,
  readFileSync,
  rmSync,
} from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { createApp } from "../apps/server/src/app";
let available = false;
try {
  available =
    execFileSync("claude", ["--version"], {
      encoding: "utf8",
      timeout: 3000,
    }).trim() === "2.1.206 (Claude Code)";
} catch {}
it.runIf(available)(
  "actual Claude CLI project adapter preserves unrelated MCP and removes only owned entry",
  async () => {
    const home = mkdtempSync(join(tmpdir(), "jev-claude-")),
      project = join(home, "project with spaces");
    mkdirSync(project);
    const path = join(project, ".mcp.json");
    writeFileSync(
      path,
      JSON.stringify(
        { mcpServers: { existing: { command: "echo", args: ["keep-me"] } } },
        null,
        2,
      ),
    );
    const s = await createApp({ home, port: 17428 });
    try {
      const p = await s.integrations.plan({
        runtime: "claude_code",
        scope: "project",
        project,
        grants: [],
      });
      expect(p.supported).toBe(true);
      const applied = await s.integrations.apply(p.plan_id);
      let content = JSON.parse(readFileSync(path, "utf8"));
      expect(content.mcpServers.existing.args).toEqual(["keep-me"]);
      expect(content.mcpServers["jev-workbench"].args).toContain(
        "--credentials-file",
      );
      expect(await s.integrations.apply(p.plan_id)).toMatchObject({
        id: applied.id,
        status: "configured",
      });
      content.mcpServers.later = { command: "echo", args: ["added-later"] };
      writeFileSync(path, JSON.stringify(content, null, 2));
      await s.integrations.remove(applied.id);
      content = JSON.parse(readFileSync(path, "utf8"));
      expect(content.mcpServers["jev-workbench"]).toBeUndefined();
      expect(content.mcpServers.later.args).toEqual(["added-later"]);
      expect(content.mcpServers.existing.args).toEqual(["keep-me"]);
    } finally {
      await s.app.close();
      rmSync(home, { recursive: true, force: true });
    }
  },
  15000,
);
