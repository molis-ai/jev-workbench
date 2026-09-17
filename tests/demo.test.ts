import { it, expect } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { createApp } from "../apps/server/src/app";
import { DemoProvider } from "../apps/server/src/demo-provider";
import { seedDemo } from "../apps/server/src/demo-seed";
import { validateConfig, evaluate } from "../apps/server/src/engine";
import template from "../examples/ticket_route.v1.json";
it("explicit demo provides normal/review/error/timeout without network; demo proof cannot publish in production", async () => {
  const home = mkdtempSync(join(tmpdir(), "jev-demo-"));
  const demo = await createApp({
    home,
    port: 17429,
    demoMode: true,
    provider: new DemoProvider(),
  });
  let prod: Awaited<ReturnType<typeof createApp>> | undefined;
  try {
    await seedDemo(demo, home);
    const official = demo.clients.create("official", "api", [], true);
    expect(
      (
        await demo.app.inject({
          url: "/v1/systemone",
          method: "POST",
          headers: {
            host: "127.0.0.1:17429",
            authorization: "Bearer " + official.token,
          },
          payload: {
            model: "jev-1.13.0",
            state: "退款",
            questions: { q: { type: "noul", instructions: "账单?" } },
          },
        })
      ).json().error.code,
    ).toBe("DEMO_MODE");
    const f = demo.functions.list()[0];
    const before = demo.clients.list().length;
    await seedDemo(demo, home);
    expect(demo.clients.list()).toHaveLength(before);
    const c = validateConfig(template);
    const p = new DemoProvider();
    for (const [text, status, department] of [
      ["重复扣款", "ok", "billing"],
      ["Please refund the duplicate charge", "ok", "billing"],
      ["API integration error", "ok", "technical"],
      ["Purchase inquiry", "ok", "sales"],
      ["unclear", "needs_review", null],
      ["接口故障", "ok", "technical"],
      ["商务购买", "ok", "sales"],
      ["不清楚", "needs_review", null],
    ]) {
      const raw = await p.evaluate(
        { model: c.model, state: { text }, questions: c.questions },
        AbortSignal.timeout(3000),
        () => {},
      );
      expect(evaluate(c, { content: text }, raw)).toMatchObject({
        status,
        data: { department },
      });
    }
    for (const [text, code] of [
      ["模拟错误", "UPSTREAM_UNAVAILABLE"],
      ["simulate error", "UPSTREAM_UNAVAILABLE"],
      ["simulate timeout", "UPSTREAM_TIMEOUT"],
      ["模拟超时", "UPSTREAM_TIMEOUT"],
    ])
      await expect(
        p.evaluate({ state: { text } }, AbortSignal.timeout(3000), () => {}),
      ).rejects.toMatchObject({ code });
    await demo.app.close();
    prod = await createApp({ home, port: 17429 });
    const current = prod.functions.get(f.id);
    expect(() =>
      prod!.functions.publish(f.id, {
        draft_revision: current.draft_revision,
        checksum: current.checksum,
      }),
    ).toThrow("试跑");
  } finally {
    await demo.app.close();
    await prod?.app.close();
    rmSync(home, { recursive: true, force: true });
  }
}, 10000);
