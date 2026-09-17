import type { Provider } from "./provider";
import { AppError } from "./errors";
import { setTimeout as delay } from "node:timers/promises";
/** Explicit, offline demo only. Never selected after a real-provider failure. */
export class DemoProvider implements Provider {
  readonly fixture = true;
  async models() {
    return {
      mode: "demo",
      models: ["jev-1.13.0"],
      notice: "离线模拟，不代表供应商可用模型",
    };
  }
  async evaluate(request: any, signal: AbortSignal, onAttempt: () => void) {
    onAttempt();
    await delay(350, undefined, { signal });
    const text = JSON.stringify(request.state);
    if (/模拟错误|simulate error/i.test(text))
      throw new AppError(
        502,
        "UPSTREAM_UNAVAILABLE",
        "离线演示：模拟上游连接错误，没有执行真实推理",
      );
    if (/模拟超时|simulate timeout/i.test(text)) {
      await delay(650, undefined, { signal });
      throw new AppError(
        504,
        "UPSTREAM_TIMEOUT",
        "离线演示：模拟上游超时，没有执行真实推理",
      );
    }
    const review = /不清楚|不知道|模糊|复核|unclear|unknown|review/i.test(text);
    const answers: any = {};
    for (const [key, q] of Object.entries(request.questions) as any) {
      if (q.type === "noul") {
        answers[key] = { type: "noul", noul: review ? 0.5 : 0.93 };
        continue;
      }
      if (q.type === "score") {
        const index = review
          ? Math.min(1, q.criteria.length - 1)
          : q.criteria.length - 1;
        answers[key] = {
          type: "score",
          score: index,
          confidence: review ? 0.45 : 0.92,
          legend: Object.fromEntries(
            q.criteria.map((s: string, i: number) => [String(i), s]),
          ),
          probabilities: Object.fromEntries(
            q.criteria.map((_: string, i: number) => [
              String(i),
              i === index ? 1 : 0,
            ]),
          ),
        };
        continue;
      }
      const keys = Object.keys(q.criteria);
      let winner = keys[0];
      if (review && keys.includes("other")) winner = "other";
      else if (
        /报错|故障|接口|technical|error|api/i.test(text) &&
        keys.includes("technical")
      )
        winner = "technical";
      else if (
        /购买|套餐|商务|purchase|sales|plan/i.test(text) &&
        keys.includes("sales")
      )
        winner = "sales";
      else if (
        /退款|账单|扣款|refund|billing|charged/i.test(text) &&
        keys.includes("billing")
      )
        winner = "billing";
      const p = review ? 0.4 : 0.94;
      answers[key] = {
        type: "choice",
        choice: winner,
        confidence: review ? 0.4 : 0.94,
        probabilities: Object.fromEntries(
          keys.map((k) => [k, k === winner ? p : (1 - p) / (keys.length - 1)]),
        ),
      };
      if (keys.length === 2 && review) {
        answers[key].probabilities = {
          [winner]: 0.5,
          [keys.find((k) => k !== winner)!]: 0.5,
        };
      }
    }
    return { model: request.model, answers };
  }
}
