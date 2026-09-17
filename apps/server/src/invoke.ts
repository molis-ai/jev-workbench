import { randomUUID } from "node:crypto";
import { type Config } from "../../../packages/contracts/src/config";
import { mapState, evaluate, checksum } from "./engine";
import { type DB, now } from "./storage";
import { type Provider, Gate } from "./provider";
import { AppError } from "./errors";
export class Invoker {
  gate = new Gate();
  controllers = new Set<AbortController>();
  timeout = 30000;
  constructor(
    private db: DB,
    private provider: Provider,
  ) {}
  async run(
    c: Config,
    input: any,
    context: {
      function_id: string;
      version?: number;
      draft_revision?: number;
      source: string;
      client_id?: string;
    },
    signal?: AbortSignal,
  ) {
    const state = mapState(c, input),
      id = randomUUID(),
      sum = checksum(c),
      start = Date.now(),
      controller = new AbortController();
    this.controllers.add(controller);
    const combined = AbortSignal.any([
      controller.signal,
      AbortSignal.timeout(this.timeout),
      ...(signal ? [signal] : []),
    ]);
    const request = { model: c.model, state, questions: c.questions };
    let attempts = 0;
    this.db
      .prepare(
        "INSERT INTO runs(request_id,function_id,version,draft_revision,config_checksum,client_id,source,execution_status,requested_model,started_at,diagnostic_meta_json) VALUES(?,?,?,?,?,?,?,'running',?,?,?)",
      )
      .run(
        id,
        context.function_id,
        context.version ?? null,
        context.draft_revision ?? null,
        sum,
        context.client_id ?? null,
        context.source,
        c.model,
        now(),
        JSON.stringify({ fixture: !!this.provider.fixture }),
      );
    try {
      const body = await this.gate.run(combined, () =>
        this.provider.evaluate(request, combined, () => attempts++),
      );
      const result = evaluate(c, input, body);
      this.db
        .prepare(
          "UPDATE runs SET execution_status='succeeded',business_status=?,resolved_model=?,provider_attempts=?,input_tokens=?,output_tokens=?,duration_ms=?,review_rule_ids_json=?,finished_at=? WHERE request_id=?",
        )
        .run(
          result.status,
          body.model,
          attempts,
          Number.isInteger(body.usage?.input_tokens)
            ? body.usage.input_tokens
            : null,
          Number.isInteger(body.usage?.output_tokens)
            ? body.usage.output_tokens
            : null,
          Date.now() - start,
          JSON.stringify(result.review_reasons),
          now(),
          id,
        );
      const response = {
        ...result,
        meta: {
          request_id: id,
          ...(this.provider.fixture ? { simulated: true } : {}),
          function_key: c.key,
          version: context.version ?? null,
          model: body.model,
          config_checksum: sum,
          duration_ms: Date.now() - start,
        },
      };
      return context.source === "preview"
        ? {
            ...response,
            debug: { request, answers: body.answers, usage: body.usage },
            fixture: !!this.provider.fixture,
          }
        : response;
    } catch (e) {
      const err =
        e instanceof AppError
          ? e
          : combined.aborted
            ? new AppError(504, "UPSTREAM_TIMEOUT", "调用已取消或超时")
            : new AppError(500, "INTERNAL_ERROR", "调用处理失败");
      this.db
        .prepare(
          "UPDATE runs SET execution_status=?,error_code=?,provider_attempts=?,duration_ms=?,finished_at=? WHERE request_id=?",
        )
        .run(
          signal?.aborted ? "cancelled" : "failed",
          err.code,
          attempts,
          Date.now() - start,
          now(),
          id,
        );
      err.requestId = id;
      throw err;
    } finally {
      this.controllers.delete(controller);
    }
  }
  async official(
    body: any,
    context: { client_id: string; source: string },
    signal?: AbortSignal,
  ) {
    const id = randomUUID(),
      start = Date.now(),
      controller = new AbortController();
    this.controllers.add(controller);
    const combined = AbortSignal.any([
      controller.signal,
      AbortSignal.timeout(this.timeout),
      ...(signal ? [signal] : []),
    ]);
    let attempts = 0;
    this.db
      .prepare(
        "INSERT INTO runs(request_id,function_id,version,draft_revision,config_checksum,client_id,source,execution_status,requested_model,started_at,diagnostic_meta_json) VALUES(?,?,?,?,?,?,?,'running',?,?,?)",
      )
      .run(
        id,
        null,
        null,
        null,
        null,
        context.client_id,
        context.source,
        body.model,
        now(),
        JSON.stringify({
          official: true,
          fixture: !!this.provider.fixture,
        }),
      );
    try {
      const response = await this.gate.run(combined, () =>
        this.provider.evaluate(body, combined, () => attempts++),
      );
      this.db
        .prepare(
          "UPDATE runs SET execution_status='succeeded',resolved_model=?,provider_attempts=?,input_tokens=?,output_tokens=?,duration_ms=?,finished_at=? WHERE request_id=?",
        )
        .run(
          response.model ?? null,
          attempts,
          Number.isInteger(response.usage?.input_tokens)
            ? response.usage.input_tokens
            : null,
          Number.isInteger(response.usage?.output_tokens)
            ? response.usage.output_tokens
            : null,
          Date.now() - start,
          now(),
          id,
        );
      return { requestId: id, response };
    } catch (e) {
      const err =
        e instanceof AppError
          ? e
          : combined.aborted
            ? new AppError(504, "UPSTREAM_TIMEOUT", "调用已取消或超时")
            : new AppError(500, "INTERNAL_ERROR", "调用处理失败");
      this.db
        .prepare(
          "UPDATE runs SET execution_status=?,error_code=?,provider_attempts=?,duration_ms=?,finished_at=? WHERE request_id=?",
        )
        .run(
          signal?.aborted ? "cancelled" : "failed",
          err.code,
          attempts,
          Date.now() - start,
          now(),
          id,
        );
      err.requestId = id;
      throw err;
    } finally {
      this.controllers.delete(controller);
    }
  }
  cancelAll() {
    for (const c of this.controllers) c.abort();
  }
}
