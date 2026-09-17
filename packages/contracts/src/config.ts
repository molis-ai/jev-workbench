import { z } from "zod";
export const safeName = z
  .string()
  .regex(/^[a-zA-Z][a-zA-Z0-9_]{0,63}$/)
  .refine((v) => !["constructor", "prototype", "__proto__"].includes(v));
const ptr = z
  .string()
  .startsWith("/")
  .refine((v) =>
    v
      .split("/")
      .slice(1)
      .every(
        (s) =>
          !["__proto__", "constructor", "prototype"].includes(
            s.replace(/~1/g, "/").replace(/~0/g, "~"),
          ),
      ),
  );
const scalar = z.union([
  z.string(),
  z.number().finite(),
  z.boolean(),
  z.null(),
]);
const field = z
  .object({
    type: z
      .union([
        z.enum(["string", "number", "boolean", "array"]),
        z
          .array(z.enum(["string", "number", "boolean", "array", "null"]))
          .min(1),
      ])
      .optional(),
    description: z.string().optional(),
    minLength: z.number().int().nonnegative().optional(),
    maxLength: z.number().int().nonnegative().optional(),
    minimum: z.number().finite().optional(),
    maximum: z.number().finite().optional(),
    items: z
      .object({ type: z.literal("string") })
      .strict()
      .optional(),
    enum: z.array(scalar).nonempty().optional(),
  })
  .strict();
export const objectSchema = z
  .object({
    type: z.literal("object"),
    properties: z.record(safeName, field),
    required: z.array(safeName),
    additionalProperties: z.literal(false),
  })
  .strict();
const question = z.discriminatedUnion("type", [
  z
    .object({
      type: z.literal("noul"),
      instructions: z.string().min(1),
      criteria: z
        .object({ true: z.string().optional(), false: z.string().optional() })
        .strict()
        .optional(),
    })
    .strict(),
  z
    .object({
      type: z.literal("choice"),
      instructions: z.string().min(1),
      criteria: z
        .record(safeName, z.string().nullable())
        .refine(
          (v) => Object.keys(v).length >= 2 && Object.keys(v).length <= 32,
        ),
    })
    .strict(),
  z
    .object({
      type: z.literal("score"),
      instructions: z.string().min(1),
      criteria: z.array(z.string().min(1)).min(2).max(32),
    })
    .strict(),
]);
export const ruleSchema = z
  .object({
    id: safeName,
    source: ptr,
    operator: z.enum([
      "eq",
      "ne",
      "lt",
      "lte",
      "gt",
      "gte",
      "in",
      "between_exclusive",
    ]),
    value: z.union([scalar, z.array(scalar)]),
  })
  .strict();
export const configSchema = z
  .object({
    format_version: z.literal(1),
    key: safeName,
    name: z.string().min(1),
    description: z.string(),
    when_to_use: z.string().min(1),
    provider: z.literal("typesafe"),
    model: z.string().min(1),
    input_schema: objectSchema,
    state_mapping: z.record(safeName, ptr),
    questions: z
      .record(safeName, question)
      .refine((q) => Object.keys(q).length >= 1 && Object.keys(q).length <= 16),
    review: z
      .object({ match: z.enum(["any", "all"]), rules: z.array(ruleSchema) })
      .strict(),
    output_mapping: z.record(
      safeName,
      z
        .object({
          source: ptr,
          enum_map: z.record(z.string(), scalar).optional(),
          on_review: scalar.optional(),
        })
        .strict(),
    ),
    output_schema: objectSchema,
  })
  .strict();
export type Config = z.infer<typeof configSchema>;
export type Rule = z.infer<typeof ruleSchema>;
export type JsonObject = Record<string, any>;
export const fixedModel = (m: string) => /^jev-\d+\.\d+\.\d+$/.test(m);
export const invokeBody = z
  .object({
    version: z.number().int().positive().optional(),
    input: z.record(z.unknown()),
  })
  .strict();
