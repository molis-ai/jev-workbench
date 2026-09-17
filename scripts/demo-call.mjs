import { readFileSync } from "node:fs";
import { join } from "node:path";
import { homedir } from "node:os";
const c = JSON.parse(
  readFileSync(
    join(
      process.env.JEV_DEMO_HOME ?? join(homedir(), ".jev-workbench-demo"),
      "clients/demo-api.json",
    ),
    "utf8",
  ),
);
const r = await fetch(c.endpoint + "/v1/functions/ticket_route/invoke", {
  method: "POST",
  headers: {
    Authorization: "Bearer " + c.token,
    "Content-Type": "application/json",
  },
  body: JSON.stringify({
    version: 1,
    input: { content: process.argv[2] ?? "我的订单被重复扣款，请协助退款。" },
  }),
  signal: AbortSignal.timeout(35000),
});
console.log(JSON.stringify(await r.json(), null, 2));
if (!r.ok) process.exitCode = 1;
