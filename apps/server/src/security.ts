import {
  randomBytes,
  createHash,
  createCipheriv,
  createDecipheriv,
} from "node:crypto";
import { existsSync, readFileSync, writeFileSync, renameSync } from "node:fs";
import { join } from "node:path";
import { fail } from "./errors";
export const token = () => randomBytes(32).toString("base64url");
export const hash = (v: string) => createHash("sha256").update(v).digest("hex");
export function atomic(path: string, value: string | Buffer) {
  const tmp = path + ".tmp-" + token();
  writeFileSync(tmp, value, { mode: 0o600, flag: "wx" });
  renameSync(tmp, path);
}
export class SecretStore {
  constructor(private home: string) {}
  get() {
    if (process.env.TYPESAFE_API_KEY) return process.env.TYPESAFE_API_KEY;
    const path = join(this.home, "secrets.json");
    if (!existsSync(path)) return undefined;
    const b = JSON.parse(readFileSync(path, "utf8"));
    const dec = createDecipheriv(
      "aes-256-gcm",
      readFileSync(join(this.home, "master.key")),
      Buffer.from(b.iv, "base64"),
    );
    dec.setAuthTag(Buffer.from(b.tag, "base64"));
    return Buffer.concat([
      dec.update(Buffer.from(b.value, "base64")),
      dec.final(),
    ]).toString();
  }
  status() {
    const k = this.get();
    return {
      configured: !!k,
      source: process.env.TYPESAFE_API_KEY ? "environment" : "encrypted_file",
      masked: k ? "••••" + k.slice(-4) : null,
    };
  }
  save(key: string) {
    if (process.env.TYPESAFE_API_KEY)
      fail(
        409,
        "ENVIRONMENT_KEY_ACTIVE",
        "环境变量 Key 正在生效，请从启动环境替换",
      );
    const path = join(this.home, "master.key");
    if (!existsSync(path))
      writeFileSync(path, randomBytes(32), { mode: 0o600, flag: "wx" });
    const iv = randomBytes(12),
      cipher = createCipheriv("aes-256-gcm", readFileSync(path), iv);
    const value = Buffer.concat([cipher.update(key), cipher.final()]);
    atomic(
      join(this.home, "secrets.json"),
      JSON.stringify({
        iv: iv.toString("base64"),
        tag: cipher.getAuthTag().toString("base64"),
        value: value.toString("base64"),
      }),
    );
  }
}
export class Sessions {
  private boot = new Map<string, number>();
  private sessions = new Map<string, { csrf: string; expires: number }>();
  bootstrap() {
    const t = token();
    this.boot.set(hash(t), Date.now() + 60000);
    return t;
  }
  consume(t: string) {
    const expiry = this.boot.get(hash(t));
    this.boot.delete(hash(t));
    if (!expiry || expiry < Date.now())
      fail(
        401,
        "BOOTSTRAP_EXPIRED",
        "引导已过期，请运行 pnpm jev service open",
      );
    const session = token(),
      csrf = token();
    this.sessions.set(hash(session), {
      csrf,
      expires: Date.now() + 12 * 3600000,
    });
    return { session, csrf };
  }
  get(t?: string) {
    const s = t ? this.sessions.get(hash(t)) : undefined;
    if (!s || s.expires < Date.now())
      fail(
        401,
        "ADMIN_SESSION_REQUIRED",
        "请运行 pnpm jev service open 重新打开管理页",
      );
    return s;
  }
}
