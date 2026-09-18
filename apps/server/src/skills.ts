import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { homedir } from "node:os";
import { existsSync } from "node:fs";
import { isAbsolute } from "node:path";
import { randomUUID } from "node:crypto";
import { type DB, now, audit } from "./storage";
import { fail } from "./errors";
import { skillAgents } from "./runtimes";
export { skillAgents };

const exec = promisify(execFile);
type Run = (
  file: string,
  args: readonly string[],
  options: { cwd?: string; timeout?: number; maxBuffer?: number },
) => Promise<{ stdout: string; stderr: string }>;
export const skillPackages: Record<string, { source: string; skill: string }> = {
  "jev-workbench": { source: process.cwd(), skill: "jev-workbench" },
  "typesafe-ai": { source: "typesafe-ai/skills", skill: "typesafe-ai" },
};
export function skillCommand(
  runtime: string,
  scope: "user" | "project",
  action: "add" | "remove",
  pkg = "typesafe-ai",
) {
  const agent = skillAgents[runtime as keyof typeof skillAgents];
  const pack = skillPackages[pkg];
  if (!agent || !pack) return null;
  const args = ["--yes", "skills@latest"];
  if (action === "add")
    args.push("add", pack.source, "--skill", pack.skill, "--agent", agent, "-y");
  else
    args.push("remove", pack.skill, "--skill", pack.skill, "--agent", agent, "-y");
  if (scope === "user") args.push("-g");
  return ["npx", ...args];
}

type Plan = {
  id: string;
  runtime: string;
  scope: "user" | "project";
  project?: string;
  skill: string;
  command: string[] | null;
  supported: boolean;
  reason?: string;
};
export class Skills {
  private plans = new Map<string, Plan>();
  constructor(
    private db: DB,
    private run: Run = exec as Run,
  ) {}
  list() {
    return this.db
      .prepare("SELECT * FROM skill_installs ORDER BY created_at DESC")
      .all();
  }
  plan(b: {
    runtime: string;
    scope: "user" | "project";
    project?: string;
    skill: string;
  }) {
    if (
      b.scope === "project" &&
      (!b.project || !isAbsolute(b.project) || !existsSync(b.project))
    )
      fail(422, "CONFIG_INVALID", "项目范围需要已有的绝对目录");
    const skill = b.skill in skillPackages ? b.skill : "";
    const command = skill ? skillCommand(b.runtime, b.scope, "add", skill) : null;
    const id = randomUUID();
    const supported = !!command;
    const plan: Plan = {
      id,
      ...b,
      skill,
      command,
      supported,
      reason: supported
        ? undefined
        : skill === "jev-workbench"
          ? "此运行端不在 skills CLI 内。请手动复制仓库 skills/jev-workbench。"
          : "此运行端不在官方 skills CLI 内。请从 https://github.com/typesafe-ai/skills 手动复制 skills/typesafe-ai。",
    };
    this.plans.set(id, plan);
    return {
      plan_id: id,
      runtime: b.runtime,
      scope: b.scope,
      project: b.project,
      skill,
      command,
      supported,
      reason: plan.reason,
      after: command ? command.join(" ") : plan.reason,
    };
  }
  async apply(id: string) {
    const existing = this.db
      .prepare("SELECT id,status FROM skill_installs WHERE id=?")
      .get(id) as { id: string; status: string } | undefined;
    if (existing) return existing;
    const p = this.plans.get(id);
    if (!p) fail(404, "PLAN_NOT_FOUND", "接入预览已过期，请重新生成");
    if (!p.supported || !p.command)
      fail(422, "CONFIG_INVALID", p.reason ?? "不支持自动安装此 Skill");
    const dup = this.db
      .prepare(
        "SELECT id,status FROM skill_installs WHERE runtime=? AND scope=? AND ifnull(project,'')=? AND skill_name=? AND status='configured'",
      )
      .get(p.runtime, p.scope, p.project ?? "", p.skill) as
      | { id: string; status: string }
      | undefined;
    if (dup) return dup;
    await this.run(p.command[0], p.command.slice(1), {
      cwd: p.project ?? homedir(),
      timeout: 120000,
      maxBuffer: 65536,
    });
    this.db
      .prepare(
        "INSERT INTO skill_installs(id,runtime,scope,project,status,command_json,created_at,updated_at,skill_name) VALUES(?,?,?,?,?,?,?,?,?)",
      )
      .run(
        p.id,
        p.runtime,
        p.scope,
        p.project ?? null,
        "configured",
        JSON.stringify(p.command),
        now(),
        now(),
        p.skill,
      );
    audit(this.db, "install", "skill", p.id, {
      runtime: p.runtime,
      scope: p.scope,
      skill: p.skill,
    });
    this.plans.delete(id);
    return { id: p.id, status: "configured", command: p.command };
  }
  async remove(id: string) {
    const i = this.db
      .prepare("SELECT * FROM skill_installs WHERE id=?")
      .get(id) as any;
    if (!i) fail(404, "INSTALLATION_NOT_FOUND", "接入不存在");
    if (i.status === "removed") return { ok: true };
    const command = skillCommand(
      i.runtime,
      i.scope,
      "remove",
      i.skill_name ?? "typesafe-ai",
    );
    if (command)
      await this.run(command[0], command.slice(1), {
        cwd: i.project ?? homedir(),
        timeout: 120000,
        maxBuffer: 65536,
      });
    this.db
      .prepare("UPDATE skill_installs SET status='removed',updated_at=? WHERE id=?")
      .run(now(), id);
    audit(this.db, "remove", "skill", id);
    return { ok: true };
  }
}
