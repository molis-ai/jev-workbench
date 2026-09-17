import { join } from "node:path";
import { homedir } from "node:os";
import {
  existsSync,
  readFileSync,
  mkdirSync,
  openSync,
  statSync,
  renameSync,
  rmSync,
} from "node:fs";
import { spawn } from "node:child_process";
import { setTimeout as delay } from "node:timers/promises";
const home = process.env.JEV_HOME ?? join(homedir(), ".jev-workbench"),
  file = join(home, "runtime/instance.json");
async function current() {
  if (!existsSync(file)) return undefined;
  const i = JSON.parse(readFileSync(file, "utf8"));
  try {
    const r = await fetch(`http://127.0.0.1:${i.port}/internal/instance`, {
      headers: { Authorization: "Bearer " + i.controlToken },
      signal: AbortSignal.timeout(1200),
    });
    const b = await r.json();
    if (b.instance === i.instance && b.pid === i.pid) return i;
  } catch {}
  return undefined;
}
const action =
  process.argv[2] === "service" ? process.argv[3] : process.argv[2];
async function open(i: any) {
  const r = await fetch(`http://127.0.0.1:${i.port}/internal/open`, {
    method: "POST",
    headers: { Authorization: "Bearer " + i.controlToken },
  });
  const b = await r.json();
  if (!r.ok) throw new Error("无法生成引导页");
  spawn(process.platform === "darwin" ? "open" : "xdg-open", [b.url], {
    stdio: "ignore",
  }).on("error", () => console.error("浏览器启动失败"));
}
try {
  if (action === "start") {
    if (await current()) {
      console.log("Jev Workbench 已在运行");
      process.exit(0);
    }
    mkdirSync(join(home, "logs"), { recursive: true, mode: 0o700 });
    const log = join(home, "logs/server.log");
    if (existsSync(log) && statSync(log).size > 2 * 1024 * 1024)
      renameSync(log, log + ".1");
    const fd = openSync(log, "a", 0o600),
      child = spawn(
        process.execPath,
        [join(process.cwd(), "dist/server/main.js")],
        {
          cwd: process.cwd(),
          env: { ...process.env, JEV_NO_OPEN: "1" },
          detached: true,
          stdio: ["ignore", fd, fd],
        },
      );
    child.unref();
    let i;
    for (let n = 0; n < 30; n++) {
      await delay(150);
      i = await current();
      if (i) break;
    }
    if (!i) throw new Error("后台启动失败；查看 " + log);
    console.log(`已启动 http://127.0.0.1:${i.port}`);
    if (!process.env.JEV_NO_OPEN) await open(i);
  } else if (action === "status") {
    const i = await current();
    console.log(
      i
        ? `运行中 · PID ${i.pid} · http://127.0.0.1:${i.port}`
        : "未运行或实例验证失败",
    );
  } else if (action === "open") {
    const i = await current();
    if (!i) throw new Error("后台未运行，请先执行 pnpm jev service start");
    await open(i);
    console.log("已打开管理页");
  } else if (action === "stop") {
    const i = await current();
    if (!i) throw new Error("无可验证实例；未向任何 PID 发送信号");
    await fetch(`http://127.0.0.1:${i.port}/internal/stop`, {
      method: "POST",
      headers: { Authorization: "Bearer " + i.controlToken },
    });
    for (let n = 0; n < 30; n++) {
      await delay(100);
      if (!(await current())) break;
    }
    if (await current()) throw new Error("服务尚未停止，请检查状态");
    console.log("后台已停止");
  } else if (action === "recover") {
    if (await current()) throw new Error("服务仍在运行，不能清理锁");
    if (existsSync(file)) {
      const i = JSON.parse(readFileSync(file, "utf8"));
      try {
        process.kill(i.pid, 0);
        throw new Error("原 PID 仍存在，请人工检查进程后恢复");
      } catch (e: any) {
        if (e.code !== "ESRCH") throw e;
      }
    } else
      throw new Error("无实例文件，不能判断锁持有者；请检查启动日志和进程");
    rmSync(join(home, "runtime/lock"), { recursive: true, force: true });
    rmSync(file, { force: true });
    console.log(
      "已清除异常退出实例锁，下一次启动将把遗留调用标记为 interrupted",
    );
  } else console.log("pnpm jev service start | status | open | stop | recover");
} catch (e: any) {
  console.error(e.message);
  process.exitCode = 1;
}
