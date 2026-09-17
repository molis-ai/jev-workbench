import { createApp } from "./app";
import { DemoProvider } from "./demo-provider";
import { seedDemo } from "./demo-seed";
import { token, atomic } from "./security";
import { join } from "node:path";
import { homedir } from "node:os";
import { mkdirSync, existsSync, readFileSync, unlinkSync } from "node:fs";
import { spawn } from "node:child_process";
process.umask(0o077);
const home =
    process.env.JEV_HOME ??
    join(
      homedir(),
      process.env.JEV_MODE === "demo"
        ? ".jev-workbench-demo"
        : ".jev-workbench",
    ),
  port = Number(
    process.env.JEV_PORT ?? (process.env.JEV_MODE === "demo" ? 17430 : 17420),
  ),
  instance = token(),
  controlToken = token();
if (!Number.isInteger(port) || port < 1024 || port > 65535)
  throw new Error("JEV_PORT must be 1024–65535");
mkdirSync(join(home, "runtime"), { recursive: true, mode: 0o700 });
const lock = join(home, "runtime/lock");
try {
  mkdirSync(lock, { mode: 0o700 });
} catch {
  console.error(
    "此数据目录已有服务锁。运行 pnpm jev service status 检查；异常退出后使用 pnpm jev service recover。",
  );
  process.exit(1);
}
let state: Awaited<ReturnType<typeof createApp>> | undefined;
let stopping = false;
async function shutdown() {
  if (stopping) return;
  stopping = true;
  const grace = setTimeout(() => state?.invoker.cancelAll(), 3000);
  grace.unref();
  await state?.app.close();
  clearTimeout(grace);
  const { rmSync } = await import("node:fs");
  rmSync(lock, { recursive: true, force: true });
  const path = join(home, "runtime/instance.json");
  if (
    existsSync(path) &&
    JSON.parse(readFileSync(path, "utf8")).instance === instance
  )
    unlinkSync(path);
  process.exit(0);
}
try {
  state = await createApp({
    home,
    port,
    instance,
    controlToken,
    shutdown,
    ...(process.env.JEV_MODE === "demo"
      ? { provider: new DemoProvider(), demoMode: true }
      : {}),
  });
  if (process.env.JEV_MODE === "demo") await seedDemo(state, home);
  await state.app.listen({ host: "127.0.0.1", port });
  atomic(
    join(home, "runtime/instance.json"),
    JSON.stringify({ instance, pid: process.pid, port, controlToken }),
  );
  console.log(`Jev Workbench: http://127.0.0.1:${port} · 本地管理 / 云端推理`);
  if (!process.env.JEV_NO_OPEN) {
    const url = state.origin + "/#bootstrap=" + state.sessions.bootstrap();
    spawn(process.platform === "darwin" ? "open" : "xdg-open", [url], {
      stdio: "ignore",
    }).on("error", () =>
      console.error("无法打开浏览器。请运行 pnpm jev service open。"),
    );
  }
  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
} catch (e: any) {
  state?.invoker.cancelAll();
  await state?.app.close();
  const { rmSync } = await import("node:fs");
  rmSync(lock, { recursive: true, force: true });
  console.error(
    e.code === "EADDRINUSE"
      ? `端口 ${port} 已被占用。请停止占用服务或设置 JEV_PORT 后重启，并更新客户端连接。`
      : "启动失败：" + e.message,
  );
  process.exit(1);
}
