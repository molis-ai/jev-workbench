import {
  existsSync,
  readFileSync,
  mkdirSync,
  unlinkSync,
  lstatSync,
} from "node:fs";
import { homedir } from "node:os";
import { join, isAbsolute } from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { parse, modify, applyEdits } from "jsonc-parser";
import { randomUUID } from "node:crypto";
import TOML from "@iarna/toml";
import YAML from "yaml";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { hash, atomic } from "./security";
import { type Clients, type Grant } from "./clients";
import { type DB, now, audit } from "./storage";
import { fail } from "./errors";
import {
  detectCommands,
  hasMcp,
  type Runtime,
} from "./runtimes";
const exec = promisify(execFile);
const OWNED = "jev-workbench";
type Plan = {
  id: string;
  runtime: Runtime;
  scope: "user" | "project";
  project?: string;
  path: string;
  before: string;
  after: string;
  entry: any;
  grants: Grant[];
  credential: string;
  command?: string[];
  supported: boolean;
  reason?: string;
};
export class Integrations {
  private plans = new Map<string, Plan>();
  private applying = new Set<string>();
  constructor(
    private home: string,
    private clients: Clients,
    private db: DB,
    private endpoint: string,
  ) {}
  async detect() {
    return Promise.all(
      Object.entries(detectCommands).map(async ([runtime, cmd]) => {
        if (!cmd)
          return { runtime, detected: false, version: null };
        try {
          const { stdout } = await exec(cmd, ["--version"], {
            timeout: 3000,
            maxBuffer: 4096,
          });
          return { runtime, detected: true, version: stdout.trim() };
        } catch {
          return { runtime, detected: false, version: null };
        }
      }),
    );
  }
  list() {
    return this.db
      .prepare("SELECT * FROM installations ORDER BY created_at DESC")
      .all();
  }
  private read(path: string) {
    if (existsSync(path) && lstatSync(path).isSymbolicLink())
      fail(409, "CONFIG_CHANGED", "配置文件是符号链接，请手动配置");
    return existsSync(path) ? readFileSync(path, "utf8") : "";
  }
  async plan(b: {
    runtime: Runtime;
    scope: "user" | "project";
    project?: string;
    grants: Grant[];
  }) {
    if (!hasMcp(b.runtime))
      fail(
        422,
        "CONFIG_INVALID",
        "此运行端不支持自动写入 MCP。请安装 Skill。",
      );
    if (
      b.scope === "project" &&
      (!b.project || !isAbsolute(b.project) || !existsSync(b.project))
    )
      fail(422, "CONFIG_INVALID", "项目范围需要已有的绝对目录");
    const id = randomUUID(),
      credential = join(this.home, "clients", `${id}.json`),
      bridge = join(process.cwd(), "dist/mcp/index.js");
    const cmd = [process.execPath, bridge, "--credentials-file", credential];
    let path = "",
      entry: any,
      after = "",
      before = "",
      command: string[] | undefined,
      supported = true,
      reason: string | undefined;
    if (b.runtime === "opencode") {
      ({ path, before, after, entry } = this.planJsonc(
        opencodePath(b.scope, b.project),
        ["mcp", OWNED],
        { type: "local", command: cmd, enabled: true },
      ));
    } else if (b.runtime === "gemini") {
      ({ path, before, after, entry } = this.planJsonc(
        join(scopeRoot(b.scope, b.project), ".gemini/settings.json"),
        ["mcpServers", OWNED],
        { command: cmd[0], args: cmd.slice(1) },
      ));
    } else if (b.runtime === "minimax_code") {
      ({ path, before, after, entry } = this.planJsonc(
        join(minimaxDir(b.scope, b.project), "mcp.json"),
        ["mcpServers", OWNED],
        { command: cmd[0], args: cmd.slice(1), enabled: true },
      ));
    } else if (b.runtime === "grok_build") {
      path = join(grokDir(b.scope, b.project), "config.toml");
      before = this.read(path);
      const doc = this.parseToml(before);
      if (doc.mcp_servers?.[OWNED])
        fail(409, "CONFIG_CHANGED", "已有 jev-workbench 条目，请先检查或撤销");
      entry = { command: cmd[0], args: cmd.slice(1) };
      after = appendToml(before, grokTable(cmd));
    } else if (b.runtime === "hermes") {
      path = join(hermesDir(b.scope, b.project), "config.yaml");
      before = this.read(path);
      const merged = hermesUpsert(before, {
        command: cmd[0],
        args: cmd.slice(1),
        enabled: true,
      });
      entry = merged.entry;
      after = merged.after;
    } else if (b.runtime === "pi") {
      path = join(
        scopeRoot(b.scope, b.project),
        b.scope === "user"
          ? ".pi/agent/extensions/jev-workbench.ts"
          : ".pi/extensions/jev-workbench.ts",
      );
      before = this.read(path);
      if (before) fail(409, "CONFIG_CHANGED", "已有 Jev 扩展，请先检查或撤销");
      entry = `import { register } from ${JSON.stringify(join(process.cwd(), "dist/pi-extension/index.js"))};\nexport default function(pi) { register(pi, ${JSON.stringify(credential)}); }\n`;
      after = entry;
    } else {
      path =
        b.runtime === "codex"
          ? join(
              process.env.CODEX_HOME ?? join(homedir(), ".codex"),
              "config.toml",
            )
          : join(
              scopeRoot(b.scope, b.project),
              b.scope === "user" ? ".claude.json" : ".mcp.json",
            );
      before = this.read(path);
      const doc = this.parseConfig(b.runtime, before);
      if (doc.mcp_servers?.[OWNED] || doc.mcpServers?.[OWNED])
        fail(409, "CONFIG_CHANGED", "已有 jev-workbench 条目，请先检查或撤销");
      command =
        b.runtime === "codex"
          ? ["codex", "mcp", "add", OWNED, "--", ...cmd]
          : [
              "claude",
              "mcp",
              "add",
              "--transport",
              "stdio",
              "--scope",
              b.scope,
              OWNED,
              "--",
              ...cmd,
            ];
      entry =
        b.runtime === "codex"
          ? { command: cmd[0], args: cmd.slice(1) }
          : { type: "stdio", command: cmd[0], args: cmd.slice(1), env: {} };
      after = JSON.stringify({ command, scope: b.scope, entry }, null, 2);
      const detected = (await this.detect()).find(
        (d) => d.runtime === b.runtime,
      );
      supported =
        b.runtime === "codex"
          ? b.scope === "user" && detected?.version === "codex-cli 0.154.0"
          : detected?.version === "2.1.206 (Claude Code)";
      if (!supported)
        reason =
          b.runtime === "codex" && b.scope === "project"
            ? "当前 Codex CLI add 只写用户范围；项目范围请按官方文档手动配置。"
            : "此 CLI 版本未验收，提供命令供手动执行，不自动改写配置。";
    }
    const plan: Plan = {
      id,
      ...b,
      path,
      before,
      after,
      entry,
      credential,
      command,
      supported,
      reason,
    };
    this.plans.set(id, plan);
    return {
      plan_id: id,
      runtime: b.runtime,
      path,
      before:
        b.runtime === "pi"
          ? before
          : "仅修改 jev-workbench 条目；其他配置保持不变。",
      after:
        b.runtime === "pi"
          ? after
          : JSON.stringify({ entry, command }, null, 2),
      supported,
      reason,
      command,
    };
  }
  async apply(id: string) {
    const existing = this.db
      .prepare("SELECT id,status FROM installations WHERE id=?")
      .get(id) as { id: string; status: string } | undefined;
    if (existing) return existing;
    if (this.applying.has(id)) fail(409, "CONFIG_CHANGED", "该变更正在应用");
    const p = this.plans.get(id);
    if (!p) fail(404, "PLAN_NOT_FOUND", "接入预览已过期，请重新生成");
    if (this.applying.has(p.path))
      fail(409, "CONFIG_CHANGED", "此配置文件正在修改，请稍后重新预览");
    if (this.read(p.path) !== p.before)
      fail(409, "CONFIG_CHANGED", "文件在预览后发生变化，请重新生成变更");
    const client = this.clients.create(
      p.runtime,
      p.runtime === "pi" ? "pi" : "mcp",
      p.grants,
    );
    this.applying.add(id);
    this.applying.add(p.path);
    let written = false;
    try {
      atomic(
        p.credential,
        JSON.stringify({ endpoint: this.endpoint, token: client.token }),
      );
      let backup: string | null = null;
      if (p.before) {
        backup = join(this.home, "backups", p.id + ".bak");
        atomic(backup, p.before);
      }
      if (p.supported) {
        if (p.command) {
          await exec(p.command[0], p.command.slice(1), {
            cwd: p.project ?? homedir(),
            timeout: 10000,
            maxBuffer: 16384,
          });
          p.after = this.read(p.path);
          const actual = this.ownedEntry(p.runtime, p.after);
          if (
            !actual ||
            actual.command !== p.entry.command ||
            JSON.stringify(actual.args) !== JSON.stringify(p.entry.args)
          )
            fail(
              409,
              "CONFIG_CHANGED",
              "CLI 写入未通过条目校验，请检查配置；凭证已撤销",
            );
          p.entry = actual;
        } else {
          mkdirSync(join(p.path, ".."), { recursive: true, mode: 0o700 });
          atomic(p.path, p.after);
          p.after = this.read(p.path);
          const actual = this.ownedEntry(p.runtime, p.after);
          if (actual !== undefined && actual !== null && p.runtime !== "pi")
            p.entry = actual;
        }
        written = true;
      }
      this.db
        .prepare(
          "INSERT INTO installations(id,runtime,scope,client_id,config_path,config_file_checksum,owned_entry_checksum,backup_path,status,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?,?)",
        )
        .run(
          p.id,
          p.runtime,
          p.scope,
          client.id,
          p.path,
          hash(p.supported ? p.after : p.before),
          hash(JSON.stringify(p.entry)),
          backup,
          p.supported ? "configured" : "planned",
          now(),
          now(),
        );
      this.db.prepare("INSERT INTO app_settings VALUES(?,?,?)").run(
        "installation:" + p.id,
        JSON.stringify({
          credential: p.credential,
          entry: p.entry,
          command: p.command,
          project: p.project,
        }),
        now(),
      );
      audit(this.db, "install", "integration", p.id);
      this.plans.delete(id);
      return {
        id: p.id,
        status: p.supported ? "configured" : "planned",
        command: p.command,
        reason: p.reason,
      };
    } catch (e) {
      this.clients.revoke(client.id);
      if (existsSync(p.credential)) unlinkSync(p.credential);
      if (written && this.read(p.path) === p.after) {
        if (p.before) atomic(p.path, p.before);
        else unlinkSync(p.path);
      }
      throw e;
    } finally {
      this.applying.delete(id);
      this.applying.delete(p.path);
    }
  }
  private planJsonc(path: string, segments: string[], entry: any) {
    const before = this.read(path);
    const src = before || "{}";
    const errors: any[] = [];
    const doc = parse(src, errors, { allowTrailingComma: true });
    if (errors.length || !doc || Array.isArray(doc))
      fail(422, "CONFIG_INVALID", "现有配置无法解析，请先修正配置文件");
    let cursor: any = doc;
    for (let i = 0; i < segments.length - 1; i++)
      cursor = cursor?.[segments[i]];
    if (cursor?.[segments[segments.length - 1]])
      fail(409, "CONFIG_CHANGED", "已有 jev-workbench 条目，请先检查或撤销");
    const after = applyEdits(
      src,
      modify(src, segments, entry, {
        formattingOptions: { insertSpaces: true, tabSize: 2 },
      }),
    );
    return { path, before, after, entry };
  }
  private parseConfig(runtime: string, text: string): any {
    try {
      return runtime === "codex" || runtime === "grok_build"
        ? TOML.parse(text || "")
        : JSON.parse(text || "{}");
    } catch {
      return fail(422, "CONFIG_INVALID", "现有配置无法解析，请先修正配置文件");
    }
  }
  private parseToml(text: string): any {
    try {
      return TOML.parse(text || "");
    } catch {
      return fail(422, "CONFIG_INVALID", "现有配置无法解析，请先修正配置文件");
    }
  }
  private ownedEntry(runtime: string, text: string): any {
    if (runtime === "opencode") {
      const errors: any[] = [];
      return parse(text || "{}", errors, { allowTrailingComma: true })?.mcp?.[
        OWNED
      ];
    }
    if (runtime === "pi") return text;
    if (runtime === "hermes") {
      try {
        return YAML.parse(text || "")?.mcp_servers?.[OWNED];
      } catch {
        return fail(
          422,
          "CONFIG_INVALID",
          "现有配置无法解析，请先修正配置文件",
        );
      }
    }
    if (runtime === "grok_build" || runtime === "codex")
      return this.parseToml(text)?.mcp_servers?.[OWNED];
    const errors: any[] = [];
    const doc = parse(text || "{}", errors, { allowTrailingComma: true });
    if (errors.length)
      fail(422, "CONFIG_INVALID", "现有配置无法解析，请先修正配置文件");
    return doc?.mcpServers?.[OWNED];
  }
  private get(id: string) {
    const i = this.db
      .prepare("SELECT * FROM installations WHERE id=?")
      .get(id) as any;
    if (!i) fail(404, "INSTALLATION_NOT_FOUND", "接入不存在");
    const raw = this.db
      .prepare("SELECT value_json FROM app_settings WHERE setting_key=?")
      .get("installation:" + id) as any;
    return { ...i, ...JSON.parse(raw.value_json) };
  }
  async test(id: string) {
    const i = this.get(id);
    if (i.status === "removed") fail(409, "CONFIG_CHANGED", "接入已撤销");
    const c = JSON.parse(readFileSync(i.credential, "utf8"));
    if (i.runtime === "pi") {
      const response = await fetch(this.endpoint + "/v1/functions", {
        headers: { Authorization: "Bearer " + c.token },
        signal: AbortSignal.timeout(5000),
      });
      if (!response.ok)
        fail(502, "CONNECTION_FAILED", "凭证或本机接口校验失败");
      this.db
        .prepare(
          "UPDATE installations SET last_test_at=?,last_test_status='http_verified',updated_at=? WHERE id=?",
        )
        .run(now(), now(), id);
      return {
        status: "http_verified",
        message: "已验证 Pi 凭证和本机 HTTP；尚未证明 Pi 已自动加载扩展。",
      };
    }
    const sdk = new Client({ name: "jev-integration-check", version: "1.0.0" });
    const transport = new StdioClientTransport({
      command: process.execPath,
      args: [
        join(process.cwd(), "dist/mcp/index.js"),
        "--credentials-file",
        i.credential,
      ],
      stderr: "pipe",
    });
    try {
      await sdk.connect(transport, { timeout: 5000 });
      const tools = await sdk.listTools();
      const result = await sdk.callTool({
        name: "jev_list_functions",
        arguments: {},
      });
      if (result.isError)
        fail(502, "CONNECTION_FAILED", "MCP 初始化成功，但凭证或后台检查失败");
      this.db
        .prepare(
          "UPDATE installations SET last_test_at=?,last_test_status='bridge_verified',updated_at=? WHERE id=?",
        )
        .run(now(), now(), id);
      return {
        status: "bridge_verified",
        tools: tools.tools.map((t) => t.name),
        message:
          "MCP 桥初始化和凭证已验证；不代表目标 Agent 已加载或执行推理。",
      };
    } finally {
      await sdk.close();
      await transport.close();
    }
  }
  async remove(id: string) {
    const i = this.get(id);
    if (i.status === "removed") return { ok: true };
    const text = this.read(i.config_path);
    if (i.runtime === "opencode") {
      this.removeJsonc(i, text, ["mcp", OWNED]);
    } else if (i.runtime === "gemini" || i.runtime === "minimax_code") {
      this.removeJsonc(i, text, ["mcpServers", OWNED]);
    } else if (i.runtime === "pi") {
      if (hash(JSON.stringify(text)) !== i.owned_entry_checksum)
        fail(409, "CONFIG_CHANGED", "扩展已被修改，请手动检查");
      unlinkSync(i.config_path);
    } else if (i.runtime === "grok_build") {
      const entry = this.parseToml(text)?.mcp_servers?.[OWNED];
      if (entry) {
        if (hash(JSON.stringify(entry)) !== i.owned_entry_checksum)
          fail(409, "CONFIG_CHANGED", "本产品条目已被修改，请先人工检查");
        const next = removeTomlTable(text);
        if (next === null)
          fail(409, "CONFIG_CHANGED", "本产品条目已被修改，请先人工检查");
        atomic(i.config_path, next);
      }
    } else if (i.runtime === "hermes") {
      hermesRemove(i.config_path, text, i.owned_entry_checksum);
    } else {
      const doc = this.parseConfig(i.runtime, text),
        entry =
          doc[i.runtime === "codex" ? "mcp_servers" : "mcpServers"]?.[OWNED];
      if (entry) {
        if (hash(JSON.stringify(entry)) !== i.owned_entry_checksum)
          fail(409, "CONFIG_CHANGED", "本产品条目已被修改，请先人工检查");
        const args =
          i.runtime === "codex"
            ? ["mcp", "remove", OWNED]
            : ["mcp", "remove", "--scope", i.scope, OWNED];
        const cli = detectCommands[i.runtime as Runtime];
        if (!cli) fail(422, "CONFIG_INVALID", "此运行端不支持自动写入 MCP。请安装 Skill。");
        await exec(cli, args, {
          cwd: i.project ?? homedir(),
          timeout: 10000,
          maxBuffer: 16384,
        });
        const after = this.parseConfig(i.runtime, this.read(i.config_path));
        if (
          after[i.runtime === "codex" ? "mcp_servers" : "mcpServers"]?.[OWNED]
        )
          fail(409, "CONFIG_CHANGED", "CLI 未移除配置条目");
      }
    }
    this.clients.revoke(i.client_id);
    if (existsSync(i.credential)) unlinkSync(i.credential);
    this.db
      .prepare(
        "UPDATE installations SET status='removed',updated_at=? WHERE id=?",
      )
      .run(now(), id);
    audit(this.db, "remove", "integration", id);
    return { ok: true };
  }
  private removeJsonc(i: any, text: string, segments: string[]) {
    const errors: any[] = [];
    const doc = parse(text, errors, { allowTrailingComma: true });
    let cursor: any = doc;
    for (let n = 0; n < segments.length - 1; n++)
      cursor = cursor?.[segments[n]];
    const entry = cursor?.[segments[segments.length - 1]];
    if (
      errors.length ||
      !entry ||
      hash(JSON.stringify(entry)) !== i.owned_entry_checksum
    )
      fail(409, "CONFIG_CHANGED", "本产品条目已被修改，无法安全撤销");
    atomic(
      i.config_path,
      applyEdits(text, modify(text, segments, undefined, {})),
    );
  }
}
function scopeRoot(scope: "user" | "project", project?: string) {
  return scope === "project" ? project! : homedir();
}
function envDir(name: string) {
  const value = process.env[name]?.trim();
  return value ? value : "";
}
function grokDir(scope: "user" | "project", project?: string) {
  if (scope === "project") return join(project!, ".grok");
  return envDir("GROK_HOME") || join(homedir(), ".grok");
}
function hermesDir(scope: "user" | "project", project?: string) {
  if (scope === "project") return join(project!, ".hermes");
  return envDir("HERMES_HOME") || join(homedir(), ".hermes");
}
function minimaxDir(scope: "user" | "project", project?: string) {
  if (scope === "project") return join(project!, ".minimax");
  return (
    envDir("MINIMAX_DATA_DIR") ||
    envDir("MAVIS_DATA_DIR") ||
    join(homedir(), ".minimax")
  );
}
function opencodePath(scope: "user" | "project", project?: string) {
  const path = join(
    scopeRoot(scope, project),
    scope === "user" ? ".config/opencode/opencode.jsonc" : "opencode.jsonc",
  );
  const alternate = path.replace(/jsonc$/, "json");
  return !existsSync(path) && existsSync(alternate) ? alternate : path;
}
function grokTable(cmd: string[]) {
  return `[mcp_servers.${OWNED}]\ncommand = ${JSON.stringify(cmd[0])}\nargs = [${cmd
    .slice(1)
    .map((s) => JSON.stringify(s))
    .join(", ")}]\n`;
}
function appendToml(text: string, block: string) {
  const body = text.replace(/\s+$/, "");
  return (body ? body + "\n\n" : "") + block;
}
function removeTomlTable(text: string) {
  const re = /^\[mcp_servers\.(?:"jev-workbench"|jev-workbench)\][ \t]*\r?\n/m;
  const match = re.exec(text);
  if (!match) return null;
  const start = match.index;
  const afterHeader = start + match[0].length;
  const rest = text.slice(afterHeader);
  const next = rest.search(/^[ \t]*\[/m);
  const end = next < 0 ? text.length : afterHeader + next;
  return (text.slice(0, start) + text.slice(end)).replace(/\n{3,}/g, "\n\n");
}
function hermesUpsert(before: string, entry: Record<string, unknown>) {
  const src = before.trim() ? before : "mcp_servers: {}\n";
  const doc = YAML.parseDocument(src);
  if (doc.errors.length)
    fail(422, "CONFIG_INVALID", "Hermes 配置不是有效 YAML");
  const servers = doc.get("mcp_servers");
  if (servers != null && typeof servers !== "object")
    fail(422, "CONFIG_INVALID", "Hermes 配置不是有效 YAML");
  if (doc.getIn(["mcp_servers", OWNED]) != null)
    fail(409, "CONFIG_CHANGED", "已有 jev-workbench 条目，请先检查或撤销");
  doc.setIn(["mcp_servers", OWNED], entry);
  return { after: String(doc), entry };
}
function hermesRemove(path: string, text: string, checksum: string) {
  let parsed: any;
  try {
    parsed = YAML.parse(text || "") ?? {};
  } catch {
    fail(422, "CONFIG_INVALID", "现有配置无法解析，请先修正配置文件");
  }
  const entry = parsed.mcp_servers?.[OWNED];
  if (!entry) return;
  if (hash(JSON.stringify(entry)) !== checksum)
    fail(409, "CONFIG_CHANGED", "本产品条目已被修改，请先人工检查");
  const doc = YAML.parseDocument(text);
  if (doc.errors.length)
    fail(422, "CONFIG_INVALID", "现有配置无法解析，请先修正配置文件");
  doc.deleteIn(["mcp_servers", OWNED]);
  atomic(path, String(doc));
}
