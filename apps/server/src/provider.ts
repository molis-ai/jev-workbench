import { setTimeout as delay } from "node:timers/promises";
import { AppError, fail } from "./errors";
import type { SecretStore } from "./security";
export interface Provider {
  evaluate(
    request: any,
    signal: AbortSignal,
    onAttempt: () => void,
  ): Promise<any>;
  models(): Promise<any>;
  fixture?: boolean;
}
export class TypeSafeProvider implements Provider {
  readonly fixture = false;
  constructor(
    private secrets: SecretStore,
    private transport: typeof fetch = fetch,
  ) {}
  async models() {
    return this.request(
      "/v1/models",
      undefined,
      AbortSignal.timeout(10000),
      () => {},
    );
  }
  async evaluate(body: any, signal: AbortSignal, onAttempt: () => void) {
    return this.request("/v1/systemone", body, signal, onAttempt);
  }
  private async request(
    path: string,
    body: any,
    signal: AbortSignal,
    onAttempt: () => void,
  ) {
    const key = this.secrets.get();
    if (!key)
      fail(503, "PROVIDER_NOT_CONFIGURED", "请在设置中配置 TypeSafe API Key");
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        onAttempt();
        const r = await this.transport("https://api.typesafe.ai" + path, {
          method: body ? "POST" : "GET",
          headers: {
            Authorization: `Bearer ${key}`,
            "Content-Type": "application/json",
          },
          body: body ? JSON.stringify(body) : undefined,
          signal,
        });
        if ([429, 529].includes(r.status)) {
          if (attempt === 1)
            fail(503, "UPSTREAM_BUSY", "供应商繁忙，请稍后手动重试");
          const retry = r.headers.get("retry-after");
          const seconds =
            retry && /^\d+(\.\d+)?$/.test(retry)
              ? Number(retry) * 1000
              : retry
                ? Date.parse(retry) - Date.now()
                : 500;
          await r.body?.cancel();
          await delay(
            Math.max(0, Number.isFinite(seconds) ? seconds : 500) +
              Math.random() * 200,
            undefined,
            { signal },
          );
          continue;
        }
        if (r.status === 401)
          fail(
            502,
            "UPSTREAM_AUTH_FAILED",
            "TypeSafe Key 无效，请在设置中替换",
          );
        if (r.status === 422)
          fail(
            422,
            "UPSTREAM_INPUT_REJECTED",
            "供应商拒绝输入，请检查模型、问题及内容长度",
          );
        if (!r.ok) fail(502, "UPSTREAM_FAILED", `供应商服务错误 (${r.status})`);
        try {
          return await r.json();
        } catch {
          fail(502, "UPSTREAM_INVALID_RESPONSE", "供应商返回了无效 JSON");
        }
      } catch (e) {
        if (e instanceof AppError) throw e;
        if (signal.aborted)
          fail(504, "UPSTREAM_TIMEOUT", "调用已取消或超出时间预算");
        fail(
          502,
          "UPSTREAM_UNAVAILABLE",
          "无法连接 TypeSafe；未自动重试，避免重复计费",
        );
      }
    }
  }
}
export class Gate {
  private active = 0;
  private waiters: Array<() => void> = [];
  constructor(
    public limit = 4,
    public capacity = 16,
  ) {}
  async run<T>(signal: AbortSignal, fn: () => Promise<T>) {
    if (signal.aborted) fail(504, "UPSTREAM_TIMEOUT", "等待已取消");
    if (this.active >= this.limit) {
      if (this.waiters.length >= this.capacity)
        fail(503, "LOCAL_BUSY", "本机等待队列已满");
      await new Promise<void>((resolve, reject) => {
        const wake = () => {
          signal.removeEventListener("abort", cancel);
          resolve();
        };
        const cancel = () => {
          this.waiters = this.waiters.filter((w) => w !== wake);
          reject(new AppError(504, "UPSTREAM_TIMEOUT", "排队已取消或超时"));
        };
        this.waiters.push(wake);
        signal.addEventListener("abort", cancel, { once: true });
      });
    } else this.active++;
    try {
      signal.throwIfAborted();
      return await fn();
    } finally {
      const next = this.waiters.shift();
      if (next) next();
      else this.active--;
    }
  }
}
