import template from "../../../examples/ticket_route.en.v1.json";
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
    note: "Offline demo seed. Not validated against a live model.",
  });
  for (const [name, content, status] of [
    ["Clear ticket", "Please refund the duplicate charge.", "ok"],
    ["Needs review", "unclear, needs review", "needs_review"],
    ["Upstream error", "simulate error", "error"],
    ["Upstream timeout", "simulate timeout", "error"],
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
  const c = state.clients.create("Offline demo API", "api", [
    { function_id: f.id, pinned_version: 1 },
  ]);
  atomic(
    join(home, "clients/demo-api.json"),
    JSON.stringify({ endpoint: state.origin, token: c.token }),
  );
}
