import { describe, it, expect } from "vitest";
import template from "../examples/ticket_route.v1.json";
import {
  validateConfig,
  mapState,
  evaluate,
  validateAnswers,
  readPointer,
  matches,
} from "../apps/server/src/engine";
import { fixture } from "./fixture";
const c = () => validateConfig(structuredClone(template));
async function answer(config = c(), ambiguous = false) {
  return fixture.evaluate(
    {
      model: config.model,
      state: { content: ambiguous ? "不清楚" : "退款" },
      questions: config.questions,
    },
    new AbortController().signal,
    () => {},
  );
}
describe("execution contract", () => {
  it("maps only declared fields and never coerces input", () => {
    expect(mapState(c(), { content: "退款" })).toEqual({ ticket_text: "退款" });
    expect(() => mapState(c(), { content: 12 })).toThrow();
    expect(() => mapState(c(), { content: "退款", secret: "extra" })).toThrow();
    expect(() => mapState(c(), {})).toThrow();
  });
  it("returns business ok and nullable review with explicit reasons", async () => {
    expect(evaluate(c(), { content: "退款" }, await answer())).toEqual({
      status: "ok",
      data: { department: "billing" },
      review_reasons: [],
    });
    expect(
      evaluate(c(), { content: "不清楚" }, await answer(c(), true)),
    ).toEqual({
      status: "needs_review",
      data: { department: null },
      review_reasons: ["low_confidence", "unclassified"],
    });
  });
  it("all rules and exclusive thresholds have exact boundaries", async () => {
    const config = c();
    config.review.match = "all";
    const a = await answer();
    a.answers.department.confidence = 0.5;
    expect(evaluate(config, { content: "x" }, a).status).toBe("ok");
    for (const x of [0.2, 0.8])
      expect(
        matches(
          {
            id: "x",
            source: "/n",
            operator: "between_exclusive",
            value: [0.2, 0.8],
          },
          { n: x },
        ),
      ).toBe(false);
    expect(
      matches(
        {
          id: "x",
          source: "/n",
          operator: "between_exclusive",
          value: [0.2, 0.8],
        },
        { n: 0.5 },
      ),
    ).toBe(true);
  });
  it("validates Noul and Score and does not invent Noul confidence", async () => {
    const config: any = c();
    config.questions = {
      yes: { type: "noul", instructions: "验证" },
      level: {
        type: "score",
        instructions: "等级",
        criteria: ["低", "高", "更高"],
      },
    };
    config.review = { match: "any", rules: [] };
    config.output_mapping = {
      probability: { source: "/answers/yes/noul" },
      level: { source: "/answers/level/score" },
    };
    config.output_schema = {
      type: "object",
      properties: {
        probability: { type: "number" },
        level: { type: "number" },
      },
      required: ["probability", "level"],
      additionalProperties: false,
    };
    validateConfig(config);
    expect(evaluate(config, {}, await answer(config)).data).toEqual({
      probability: 0.95,
      level: 1,
    });
    const a = await answer(config);
    a.answers.yes.confidence = 0.5;
    expect(() => validateAnswers(config, a)).toThrow();
    a.answers.yes = { type: "noul", noul: 0.7 };
    a.answers.level.score = 9;
    expect(() => validateAnswers(config, a)).toThrow();
  });
  it("rejects corrupt answers, options, distributions and fixed model mismatch", async () => {
    for (const mutate of [
      (a: any) => delete a.answers.department,
      (a: any) => (a.answers.department.type = "noul"),
      (a: any) => (a.answers.department.choice = "unknown"),
      (a: any) => (a.answers.department.confidence = NaN),
      (a: any) => (a.answers.department.probabilities.billing = 0.1),
      (a: any) => (a.model = "jev-1.14.0"),
    ]) {
      const a = await answer();
      mutate(a);
      expect(() => validateAnswers(c(), a)).toThrow();
    }
  });
  it("rejects invalid schemas, unsafe paths and incomplete enum maps before publish", () => {
    for (const path of [
      "/__proto__/x",
      "/constructor",
      "/prototype",
      "/missing",
    ])
      expect(() => readPointer({}, path)).toThrow();
    const config: any = c();
    config.output_mapping.department.enum_map = { billing: "finance" };
    expect(() => validateConfig(config)).toThrow(/覆盖/);
    config.output_mapping.department.enum_map = {
      billing: "finance",
      technical: "support",
      sales: "sales",
      other: "other",
    };
    config.output_schema.properties.department = {
      enum: ["finance", "support", "sales", "other", null],
    };
    expect(validateConfig(config)).toBeTruthy();
    config.input_schema.properties.content.$ref = "https://example.com";
    expect(() => validateConfig(config)).toThrow();
  });
  it("missing answer paths never silently count as non-match", () =>
    expect(() =>
      matches({ id: "x", source: "/n", operator: "eq", value: false }, {}),
    ).toThrow());
});
