import Ajv from "ajv";
import { createHash } from "node:crypto";
import {
  configSchema,
  fixedModel,
  type Config,
  type Rule,
  type JsonObject,
} from "../../../packages/contracts/src/config";
import { fail } from "./errors";
const ajv = new Ajv({
  allErrors: true,
  strict: false,
  coerceTypes: false,
  removeAdditional: false,
});
export function canonical(v: any): string {
  if (Array.isArray(v)) return "[" + v.map(canonical).join(",") + "]";
  if (v && typeof v === "object")
    return (
      "{" +
      Object.keys(v)
        .sort()
        .map((k) => JSON.stringify(k) + ":" + canonical(v[k]))
        .join(",") +
      "}"
    );
  return JSON.stringify(v);
}
export const checksum = (v: unknown) =>
  "sha256:" + createHash("sha256").update(canonical(v)).digest("hex");
export function readPointer(obj: any, path: string, optional = false): any {
  if (!path.startsWith("/"))
    fail(422, "CONFIG_INVALID", "路径必须是 JSON Pointer");
  let value = obj;
  for (const part of path.slice(1).split("/")) {
    if (/~(?![01])/u.test(part)) fail(422, "CONFIG_INVALID", "路径转义无效");
    const key = part.replace(/~1/g, "/").replace(/~0/g, "~");
    if (["__proto__", "constructor", "prototype"].includes(key))
      fail(422, "CONFIG_INVALID", "不允许的路径");
    if (value == null || !Object.hasOwn(value, key)) {
      if (optional) return undefined;
      fail(422, "CONFIG_INVALID", `路径不存在: ${path}`);
    }
    value = value[key];
  }
  return value;
}
function sourceSchema(c: Config, path: string): JsonObject {
  const bits = path.split("/").slice(1);
  if (bits[0] === "input" && bits.length === 2) {
    const f = c.input_schema.properties[bits[1]];
    if (f && !c.input_schema.required.includes(bits[1]))
      fail(422, "CONFIG_INVALID", `输出或规则不能依赖可缺失的输入: ${path}`);
    if (f) return f;
  }
  if (bits[0] === "answers" && bits.length === 3) {
    const q = c.questions[bits[1]];
    if (q) {
      if (bits[2] === "noul" && q.type === "noul")
        return { type: "number", minimum: 0, maximum: 1 };
      if (bits[2] === "confidence" && q.type !== "noul")
        return { type: "number", minimum: 0, maximum: 1 };
      if (bits[2] === "score" && q.type === "score")
        return { type: "number", minimum: 0, maximum: q.criteria.length - 1 };
      if (bits[2] === "choice" && q.type === "choice")
        return { type: "string", enum: Object.keys(q.criteria) };
    }
  }
  return fail(422, "CONFIG_INVALID", `不支持的来源: ${path}`);
}
export function inferOutput(c: Config): JsonObject {
  const properties: JsonObject = {};
  for (const [key, m] of Object.entries(c.output_mapping)) {
    let s = { ...sourceSchema(c, m.source) };
    if (m.enum_map) {
      if (
        !s.enum ||
        s.enum.some((v: any) => !Object.hasOwn(m.enum_map!, String(v)))
      )
        fail(
          422,
          "CONFIG_INVALID",
          `output_mapping.${key}.enum_map 必须覆盖所有可能值`,
        );
      s = {
        enum: [...new Set(s.enum.map((v: any) => m.enum_map![String(v)]))],
      };
    }
    if (Object.hasOwn(m, "on_review")) {
      if (s.enum) {
        s.enum = [...new Set([...s.enum, m.on_review])];
        delete s.type;
      } else if (m.on_review === null) s = { ...s, type: [s.type, "null"] };
      else if (typeof m.on_review !== s.type)
        fail(422, "CONFIG_INVALID", `${key} 的复核值与来源类型冲突`);
    }
    properties[key] = s;
  }
  return {
    type: "object",
    properties,
    required: Object.keys(properties),
    additionalProperties: false,
  };
}
export function validateConfig(raw: unknown): Config {
  const p = configSchema.safeParse(raw);
  if (!p.success)
    fail(
      422,
      "CONFIG_INVALID",
      "请修正配置字段",
      p.error.issues.map((i) => ({
        path: i.path.join("."),
        message: i.message,
      })),
    );
  const c = p.data;
  for (const [k, f] of Object.entries(c.input_schema.properties)) {
    if (
      !f.type ||
      Array.isArray(f.type) ||
      (f.type === "array" && !f.items) ||
      (f.type !== "array" && f.items)
    )
      fail(
        422,
        "CONFIG_INVALID",
        `input_schema.properties.${k}: 只支持标量与 string[]`,
      );
    if (
      (f.maxLength !== undefined &&
        f.minLength !== undefined &&
        f.maxLength < f.minLength) ||
      (f.minimum !== undefined &&
        f.maximum !== undefined &&
        f.minimum > f.maximum)
    )
      fail(422, "CONFIG_INVALID", `${k}: 边界顺序无效`);
  }
  if (
    new Set(c.input_schema.required).size !== c.input_schema.required.length ||
    c.input_schema.required.some(
      (k) => !Object.hasOwn(c.input_schema.properties, k),
    )
  )
    fail(422, "CONFIG_INVALID", "required 必须引用已有输入字段");
  for (const path of Object.values(c.state_mapping)) {
    if (
      path.split("/").length !== 2 ||
      !Object.hasOwn(c.input_schema.properties, path.slice(1))
    )
      fail(422, "CONFIG_INVALID", `state_mapping 路径不存在: ${path}`);
  }
  if (new Set(c.review.rules.map((r) => r.id)).size !== c.review.rules.length)
    fail(422, "CONFIG_INVALID", "复核规则 id 重复");
  for (const r of c.review.rules) {
    const s = sourceSchema(c, r.source);
    const numeric = ["lt", "lte", "gt", "gte", "between_exclusive"].includes(
      r.operator,
    );
    if (numeric && s.type !== "number")
      fail(422, "CONFIG_INVALID", `${r.id}: 数值比较需要数值来源`);
    if (r.operator === "between_exclusive") {
      if (
        !Array.isArray(r.value) ||
        r.value.length !== 2 ||
        r.value.some((v) => typeof v !== "number") ||
        r.value[0]! >= r.value[1]!
      )
        fail(422, "CONFIG_INVALID", `${r.id}: 需要递增的两个数值`);
    } else if (r.operator === "in") {
      if (!Array.isArray(r.value) || r.value.some((v) => !ajv.validate(s, v)))
        fail(422, "CONFIG_INVALID", `${r.id}: in 需要同类型数组`);
    } else if (
      Array.isArray(r.value) ||
      !ajv.validate(
        { ...s, enum: undefined, minimum: undefined, maximum: undefined },
        r.value,
      )
    )
      fail(422, "CONFIG_INVALID", `${r.id}: 比较值类型错误`);
  }
  const inferred = inferOutput(c);
  const keys = Object.keys(inferred.properties);
  if (
    keys.length === 0 ||
    keys.length !== Object.keys(c.output_schema.properties).length ||
    keys.some((k) => !Object.hasOwn(c.output_schema.properties, k)) ||
    keys.some((k) => !c.output_schema.required.includes(k))
  )
    fail(422, "CONFIG_INVALID", "output_schema 字段必须与输出映射一致");
  for (const k of keys) {
    const s = inferred.properties[k],
      t = c.output_schema.properties[k];
    if (t.type) {
      const types = Array.isArray(s.type)
        ? s.type
        : s.type
          ? [s.type]
          : [
              ...new Set(
                s.enum.map((v: any) => (v === null ? "null" : typeof v)),
              ),
            ];
      const declared = Array.isArray(t.type) ? t.type : [t.type];
      if (
        types.some((v: string) => !declared.includes(v as any)) ||
        declared.some((v) => !types.includes(v))
      )
        fail(
          422,
          "CONFIG_INVALID",
          `${k}: 输出声明与推导类型冲突；可用 enum 表达 nullable`,
        );
    }
    if (t.enum) {
      if (
        t.enum.some((v) => !ajv.validate(s, v)) ||
        s.enum?.some((v: any) => !t.enum!.includes(v))
      )
        fail(422, "CONFIG_INVALID", `${k}: 输出枚举与映射冲突`);
    }
  }
  ajv.compile(c.input_schema);
  ajv.compile(c.output_schema);
  return c;
}
export function mapState(c: Config, input: unknown) {
  const valid = ajv.compile(c.input_schema);
  if (!valid(input))
    fail(422, "INPUT_SCHEMA_INVALID", "输入不符合函数要求", valid.errors);
  return Object.fromEntries(
    Object.entries(c.state_mapping)
      .map(([k, p]) => [k, readPointer(input, p, true)])
      .filter(([, v]) => v !== undefined),
  );
}
export function validateAnswers(c: Config, body: any) {
  const bad = () =>
    fail(502, "UPSTREAM_INVALID_RESPONSE", "供应商响应不符合问题合同");
  if (
    !body ||
    typeof body.model !== "string" ||
    !body.answers ||
    typeof body.answers !== "object"
  )
    bad();
  if (fixedModel(c.model) && c.model !== body.model)
    fail(502, "MODEL_VERSION_MISMATCH", "供应商返回的模型版本与请求不一致");
  const unit = (n: any) =>
    typeof n === "number" && Number.isFinite(n) && n >= 0 && n <= 1;
  for (const [id, q] of Object.entries(c.questions)) {
    const a = body.answers[id];
    if (!a || a.type !== q.type) bad();
    if (q.type === "noul") {
      if (!unit(a.noul) || Object.hasOwn(a, "confidence")) bad();
      continue;
    }
    if (
      !unit(a.confidence) ||
      !a.probabilities ||
      Array.isArray(a.probabilities)
    )
      bad();
    const keys =
      q.type === "choice"
        ? Object.keys(q.criteria)
        : q.criteria.map((_, i) => String(i));
    if (
      Object.keys(a.probabilities).length !== keys.length ||
      keys.some((k) => !unit(a.probabilities[k])) ||
      Math.abs(keys.reduce((n, k) => n + a.probabilities[k], 0) - 1) > 0.001
    )
      bad();
    if (q.type === "choice") {
      if (
        !keys.includes(a.choice) ||
        keys.some((k) => a.probabilities[k] > a.probabilities[a.choice] + 1e-8)
      )
        bad();
    } else {
      if (
        typeof a.score !== "number" ||
        !Number.isFinite(a.score) ||
        a.score < 0 ||
        a.score > keys.length - 1 ||
        !a.legend ||
        Object.keys(a.legend).length !== keys.length ||
        keys.some((k) => a.legend[k] !== q.criteria[Number(k)])
      )
        bad();
    }
  }
  return body;
}
export function matches(rule: Rule, root: JsonObject) {
  const a = readPointer(root, rule.source),
    b = rule.value;
  if (rule.operator === "in") return (b as unknown[]).includes(a);
  if (rule.operator === "between_exclusive") {
    if (typeof a !== "number")
      fail(422, "CONFIG_INVALID", "数值规则来源类型错误");
    return a > (b as number[])[0] && a < (b as number[])[1];
  }
  if (typeof a !== typeof b) fail(422, "CONFIG_INVALID", "规则比较类型错误");
  switch (rule.operator) {
    case "eq":
      return a === b;
    case "ne":
      return a !== b;
    case "lt":
      return a < b!;
    case "lte":
      return a <= b!;
    case "gt":
      return a > b!;
    case "gte":
      return a >= b!;
    default:
      return false;
  }
}
export function evaluate(c: Config, input: JsonObject, body: JsonObject) {
  validateAnswers(c, body);
  const root = { input, answers: body.answers };
  const hits = c.review.rules.filter((r) => matches(r, root)).map((r) => r.id);
  const review =
    c.review.rules.length > 0 &&
    (c.review.match === "any"
      ? hits.length > 0
      : hits.length === c.review.rules.length);
  const data: JsonObject = {};
  for (const [key, m] of Object.entries(c.output_mapping)) {
    let v = readPointer(root, m.source);
    if (m.enum_map) {
      if (!Object.hasOwn(m.enum_map, String(v)))
        fail(502, "UPSTREAM_INVALID_RESPONSE", "输出映射缺少值");
      v = m.enum_map[String(v)];
    }
    if (review && Object.hasOwn(m, "on_review")) v = m.on_review;
    data[key] = v;
  }
  if (!ajv.validate(c.output_schema, data))
    fail(502, "UPSTREAM_INVALID_RESPONSE", "输出未通过 schema 校验");
  return {
    status: review ? "needs_review" : "ok",
    data,
    review_reasons: review ? hits : [],
  };
}
