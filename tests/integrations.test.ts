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
import YAML from "yaml";
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
    await expect(
      s.integrations.plan({
        runtime: "openclaw",
        scope: "project",
        project,
        grants: [],
      }),
    ).rejects.toMatchObject({ code: "CONFIG_INVALID" });
    const geminiPath = join(project, ".gemini/settings.json");
    mkdirSync(join(project, ".gemini"));
    writeFileSync(
      geminiPath,
      '{\n  // keep gemini\n  "theme": "keep",\n  "mcpServers": { "other": { "command": "keep" } }\n}\n',
    );
    const gemini = await s.integrations.plan({
      runtime: "gemini",
      scope: "project",
      project,
      grants: [],
    });
    const geminiInstall = await s.integrations.apply(gemini.plan_id);
    const geminiDoc = parse(readFileSync(geminiPath, "utf8"));
    expect(geminiDoc.theme).toBe("keep");
    expect(geminiDoc.mcpServers.other.command).toBe("keep");
    expect(geminiDoc.mcpServers["jev-workbench"].command).toBe(process.execPath);
    expect(geminiDoc.mcpServers["jev-workbench"].type).toBeUndefined();
    expect(readFileSync(geminiPath, "utf8")).toContain("// keep gemini");
    await s.integrations.remove(geminiInstall.id);
    expect(parse(readFileSync(geminiPath, "utf8")).mcpServers["jev-workbench"]).toBeUndefined();
    expect(parse(readFileSync(geminiPath, "utf8")).mcpServers.other.command).toBe(
      "keep",
    );
    const grokPath = join(project, ".grok/config.toml");
    mkdirSync(join(project, ".grok"));
    writeFileSync(
      grokPath,
      '# keep grok\nmodel = "keep-model"\n\n[mcp_servers.other]\ncommand = "keep"\n',
    );
    const grok = await s.integrations.plan({
      runtime: "grok_build",
      scope: "project",
      project,
      grants: [],
    });
    const grokInstall = await s.integrations.apply(grok.plan_id);
    const grokText = readFileSync(grokPath, "utf8");
    expect(grokText).toContain("# keep grok");
    expect(grokText).toContain('model = "keep-model"');
    expect(grokText).toContain("[mcp_servers.other]");
    expect(grokText).toContain("[mcp_servers.jev-workbench]");
    expect(grokText).not.toContain("http_headers");
    await s.integrations.remove(grokInstall.id);
    const grokRemoved = readFileSync(grokPath, "utf8");
    expect(grokRemoved).toContain("# keep grok");
    expect(grokRemoved).toContain("[mcp_servers.other]");
    expect(grokRemoved).not.toContain("jev-workbench");
    const hermesPath = join(project, ".hermes/config.yaml");
    mkdirSync(join(project, ".hermes"));
    writeFileSync(
      hermesPath,
      "# keep hermes\nmodel:\n  default: keep-model\nmcp_servers:\n  other:\n    command: keep\n",
    );
    const hermes = await s.integrations.plan({
      runtime: "hermes",
      scope: "project",
      project,
      grants: [],
    });
    const hermesInstall = await s.integrations.apply(hermes.plan_id);
    const hermesDoc = YAML.parse(readFileSync(hermesPath, "utf8"));
    expect(hermesDoc.model.default).toBe("keep-model");
    expect(hermesDoc.mcp_servers.other.command).toBe("keep");
    expect(hermesDoc.mcp_servers["jev-workbench"].command).toBe(
      process.execPath,
    );
    expect(hermesDoc.mcp_servers["jev-workbench"].enabled).toBe(true);
    expect(hermesDoc.mcp_servers["jev-workbench"].type).toBeUndefined();
    await s.integrations.remove(hermesInstall.id);
    const hermesRemoved = YAML.parse(readFileSync(hermesPath, "utf8"));
    expect(hermesRemoved.model.default).toBe("keep-model");
    expect(hermesRemoved.mcp_servers.other.command).toBe("keep");
    expect(hermesRemoved.mcp_servers["jev-workbench"]).toBeUndefined();
    const mcodePath = join(project, ".minimax/mcp.json");
    mkdirSync(join(project, ".minimax"));
    writeFileSync(
      mcodePath,
      JSON.stringify({
        version: 7,
        mcpServers: { other: { command: "keep" } },
      }),
    );
    const mcode = await s.integrations.plan({
      runtime: "minimax_code",
      scope: "project",
      project,
      grants: [],
    });
    const mcodeInstall = await s.integrations.apply(mcode.plan_id);
    const mcodeDoc = JSON.parse(readFileSync(mcodePath, "utf8"));
    expect(mcodeDoc.version).toBe(7);
    expect(mcodeDoc.mcpServers.other.command).toBe("keep");
    expect(mcodeDoc.mcpServers["jev-workbench"].enabled).toBe(true);
    expect(mcodeDoc.mcpServers["jev-workbench"].command).toBe(process.execPath);
    await s.integrations.remove(mcodeInstall.id);
    expect(
      JSON.parse(readFileSync(mcodePath, "utf8")).mcpServers["jev-workbench"],
    ).toBeUndefined();
    expect(JSON.parse(readFileSync(mcodePath, "utf8")).mcpServers.other.command).toBe(
      "keep",
    );
  } finally {
    await s.app.close();
    rmSync(home, { recursive: true, force: true });
  }
});
