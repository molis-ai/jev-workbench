import { it, expect } from "vitest";
import { mkdtempSync, mkdirSync, rmSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { createApp } from "../apps/server/src/app";
import { fixture } from "./fixture";
import { Skills, skillCommand } from "../apps/server/src/skills";

it("builds official skills CLI commands and records optional install/remove without touching the user home", async () => {
  expect(skillCommand("claude_code", "user", "add")).toEqual([
    "npx",
    "--yes",
    "skills@latest",
    "add",
    "typesafe-ai/skills",
    "--skill",
    "typesafe-ai",
    "--agent",
    "claude-code",
    "-y",
    "-g",
  ]);
  expect(skillCommand("pi", "user", "add")).toBeNull();
  expect(skillCommand("claude_code", "project", "add", "jev-workbench")).toEqual(
    [
      "npx",
      "--yes",
      "skills@latest",
      "add",
      process.cwd(),
      "--skill",
      "jev-workbench",
      "--agent",
      "claude-code",
      "-y",
    ],
  );
  const skillMd = readFileSync("skills/jev-workbench/SKILL.md", "utf8");
  expect(skillMd).toContain("jev_list_functions");
  expect(skillMd).toContain("Invent a function key");
  const home = mkdtempSync(join(tmpdir(), "jev-skill-")),
    project = join(home, "proj");
  mkdirSync(project);
  const runs: any[] = [];
  const s = await createApp({
    home,
    port: 17427,
    provider: fixture,
    testMode: true,
  });
  const skills = new Skills(s.db, async (cmd, args, opts) => {
    runs.push({ cmd, args, cwd: opts.cwd });
    return { stdout: "ok", stderr: "" } as any;
  });
  try {
    const unsupported = skills.plan({
      runtime: "pi",
      scope: "project",
      project,
      skill: "jev-workbench",
    });
    expect(unsupported.supported).toBe(false);
    const plan = skills.plan({
      runtime: "claude_code",
      scope: "project",
      project,
      skill: "jev-workbench",
    });
    expect(plan.supported).toBe(true);
    expect(plan.command?.join(" ")).toContain("jev-workbench");
    const applied = await skills.apply(plan.plan_id);
    expect(applied.status).toBe("configured");
    expect(runs[0].cwd).toBe(project);
    expect(runs[0].args).not.toContain("-g");
    expect(skills.list()).toHaveLength(1);
    await skills.remove(applied.id);
    expect(runs[1].args[0]).toBe("--yes");
    expect(runs[1].args).toContain("remove");
    expect((skills.list() as any[])[0].status).toBe("removed");
  } finally {
    await s.app.close();
    rmSync(home, { recursive: true, force: true });
  }
});
