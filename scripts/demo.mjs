import { spawn } from "node:child_process";
import { join } from "node:path";
import { homedir } from "node:os";
const action = process.argv[2] ?? "start";
const child = spawn(
  process.execPath,
  ["dist/server/cli.js", "service", action],
  {
    cwd: process.cwd(),
    stdio: "inherit",
    env: {
      ...process.env,
      JEV_MODE: "demo",
      JEV_HOME:
        process.env.JEV_DEMO_HOME ?? join(homedir(), ".jev-workbench-demo"),
      JEV_PORT: process.env.JEV_DEMO_PORT ?? "17430",
    },
  },
);
child.on("exit", (code) => process.exit(code ?? 1));
