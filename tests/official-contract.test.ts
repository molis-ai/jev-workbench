import { describe, it, expect } from "vitest";
import { officialBody } from "../packages/contracts/src/config";
import {
  validateConfig,
  validateAnswers,
  evaluate,
} from "../apps/server/src/engine";

function baseConfig(questions: any, mapping: any, schema: any) {
  return validateConfig({
    format_version: 1,
    key: "docs_example",
    name: "docs",
    description: "Published TypeSafe example",
    when_to_use: "Verify documented answer shapes",
    provider: "typesafe",
    model: "jev-latest",
    input_schema: {
      type: "object",
      properties: { content: { type: "string", minLength: 1 } },
      required: ["content"],
      additionalProperties: false,
    },
    state_mapping: { ticket: "/content" },
    questions,
    review: { match: "any", rules: [] },
    output_mapping: mapping,
    output_schema: schema,
  });
}

describe("published TypeSafe contract", () => {
  it("accepts the official quickstart request on the proxy body", () => {
    const request = {
      state:
        "Hi, I've been trying to connect my Stripe account for 3 days and it keeps failing. I'm losing sales. Please help ASAP.",
      model: "jev-latest",
      questions: {
        department: {
          type: "choice",
          instructions: "Which team should handle this",
          criteria: {
            billing: "Payment or subscription issues",
            technical: "Bugs or integration problems",
            sales: "Pricing or account questions",
          },
        },
        frustration: {
          type: "score",
          instructions: "How frustrated the customer appears",
          criteria: [
            "Calm, just stating facts",
            "Frustrated but civil",
            "Very angry, strong language",
          ],
        },
        is_urgent: {
          type: "noul",
          instructions: "The message conveys urgency or time-sensitivity",
        },
      },
    };
    expect(officialBody.parse(request)).toEqual(request);
  });

  it("accepts the documented Noul answer (noul only, no confidence)", () => {
    const config = baseConfig(
      {
        is_urgent: { type: "noul", instructions: "Does this convey urgency?" },
      },
      { p: { source: "/answers/is_urgent/noul" } },
      {
        type: "object",
        properties: { p: { type: "number" } },
        required: ["p"],
        additionalProperties: false,
      },
    );
    const body = {
      model: "jev-latest",
      answers: { is_urgent: { type: "noul", noul: 0.92 } },
      usage: { input_tokens: 312, output_tokens: 48 },
    };
    expect(evaluate(config, { content: "urgent" }, body)).toEqual({
      status: "ok",
      data: { p: 0.92 },
      review_reasons: [],
    });
  });

  it("accepts the documented Choice answer (argmax + full distribution)", () => {
    const config = baseConfig(
      {
        department: {
          type: "choice",
          instructions: "Which team should handle this?",
          criteria: {
            returns: "Exchanges, refunds, wrong or damaged items",
            shipping: "Delivery status, delays, lost packages",
            billing: "Charges, invoices, payment problems",
          },
        },
      },
      { department: { source: "/answers/department/choice" } },
      {
        type: "object",
        properties: { department: { type: "string" } },
        required: ["department"],
        additionalProperties: false,
      },
    );
    const body = {
      model: "jev-latest",
      answers: {
        department: {
          type: "choice",
          choice: "returns",
          confidence: 1.0,
          probabilities: { shipping: 0.0, returns: 1.0, billing: 0.0 },
        },
      },
    };
    expect(evaluate(config, { content: "wrong size" }, body).data).toEqual({
      department: "returns",
    });
  });

  it("accepts the documented Score answer as the probability-weighted level", () => {
    const config = baseConfig(
      {
        bug_severity: {
          type: "score",
          instructions: "How severe is the reported issue?",
          criteria: [
            "Cosmetic; no impact to functionality",
            "Broken or degraded feature, but workaround exists",
            "Blocking issue; no workaround exists",
          ],
        },
      },
      { severity: { source: "/answers/bug_severity/score" } },
      {
        type: "object",
        properties: { severity: { type: "number" } },
        required: ["severity"],
        additionalProperties: false,
      },
    );
    const body = {
      model: "jev-latest",
      answers: {
        bug_severity: {
          type: "score",
          score: 1.3,
          confidence: 0.54,
          legend: {
            "0": "Cosmetic; no impact to functionality",
            "1": "Broken or degraded feature, but workaround exists",
            "2": "Blocking issue; no workaround exists",
          },
          probabilities: { "0": 0.0, "1": 0.7, "2": 0.3 },
        },
      },
    };
    expect(evaluate(config, { content: "safari crash" }, body).data).toEqual({
      severity: 1.3,
    });
  });

  it("rejects Noul confidence and a Score that is not Σ i·P(i)", () => {
    const config = baseConfig(
      {
        yes: { type: "noul", instructions: "Is this true?" },
        level: {
          type: "score",
          instructions: "Severity",
          criteria: ["low", "mid", "high"],
        },
      },
      { p: { source: "/answers/yes/noul" } },
      {
        type: "object",
        properties: { p: { type: "number" } },
        required: ["p"],
        additionalProperties: false,
      },
    );
    expect(() =>
      validateAnswers(config, {
        model: "jev-latest",
        answers: {
          yes: { type: "noul", noul: 0.9, confidence: 0.9 },
          level: {
            type: "score",
            score: 1,
            confidence: 0.5,
            legend: { "0": "low", "1": "mid", "2": "high" },
            probabilities: { "0": 0, "1": 1, "2": 0 },
          },
        },
      }),
    ).toThrow();
    expect(() =>
      validateAnswers(config, {
        model: "jev-latest",
        answers: {
          yes: { type: "noul", noul: 0.9 },
          level: {
            type: "score",
            score: 2,
            confidence: 0.5,
            legend: { "0": "low", "1": "mid", "2": "high" },
            probabilities: { "0": 0, "1": 1, "2": 0 },
          },
        },
      }),
    ).toThrow();
  });

  it("function path rejects a different pinned model id in the provider response", () => {
    const config = baseConfig(
      { yes: { type: "noul", instructions: "yes?" } },
      { p: { source: "/answers/yes/noul" } },
      {
        type: "object",
        properties: { p: { type: "number" } },
        required: ["p"],
        additionalProperties: false,
      },
    );
    const pinned = { ...config, model: "jev-1.13.0" };
    expect(() =>
      validateAnswers(pinned as any, {
        model: "jev-latest",
        answers: { yes: { type: "noul", noul: 0.9 } },
      }),
    ).toThrow(/模型版本/);
  });
});
