import template from "../../../examples/ticket_route.v1.json";
import type { createApp } from "./app";
import { atomic } from "./security";
import { join } from "node:path";
import { now } from "./storage";
import { randomUUID } from "node:crypto";
export async function seedDemo(
  state: Awaited<ReturnType<typeof createApp>>,
  home: string,
) {
  if (state.functions.list().length) return;
  const f = state.functions.create(template);
  await state.invoker.run(
    f.draft,
    { content: "我的订单被重复扣款，请协助退款。" },
    { function_id: f.id, source: "preview", draft_revision: 1 },
  );
  state.functions.publish(f.id, {
    draft_revision: 1,
    checksum: f.checksum,
    note: "离线演示初始版本，未经过真实模型验证",
  });
  for (const [name, content, status] of [
    ["明确工单", "我的订单被重复扣款，请协助退款。", "ok"],
    ["需要复核", "情况不清楚，需要再确认", "needs_review"],
    ["上游错误", "模拟错误", "error"],
    ["上游超时", "模拟超时", "error"],
  ])
    state.db
      .prepare("INSERT INTO test_cases VALUES(?,?,?,?,?,?,?)")
      .run(
        randomUUID(),
        f.id,
        name,
        JSON.stringify({ content }),
        JSON.stringify(
          status === "error" ? [] : [{ path: "/status", equals: status }],
        ),
        now(),
        now(),
      );
  const c = state.clients.create("离线演示 API", "api", [
    { function_id: f.id, pinned_version: 1 },
  ]);
  atomic(
    join(home, "clients/demo-api.json"),
    JSON.stringify({ endpoint: state.origin, token: c.token }),
  );
}
