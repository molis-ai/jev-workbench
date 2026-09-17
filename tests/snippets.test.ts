import { it, expect } from "vitest";
import { execFileSync } from "node:child_process";
import { sample, shellQuote } from "../apps/web/src/api";
import { snippet } from "../apps/web/src/snippets";
it("schema examples satisfy required bounds and shell quoting preserves apostrophes and literal substitutions", () => {
  const schema = {
    properties: {
      content: {
        type: "string",
        description: "O'Brien $(printf injected)",
        minLength: 2,
        maxLength: 100,
      },
      n: { type: "number", minimum: 4 },
      truth: { type: "string", enum: ["false"] },
    },
  };
  expect(sample(schema)).toEqual({
    content: "O'Brien $(printf injected)",
    n: 4,
    truth: "false",
  });
  expect(
    execFileSync(
      "/bin/sh",
      ["-c", "printf %s " + shellQuote(sample(schema).content)],
      { encoding: "utf8" },
    ),
  ).toBe("O'Brien $(printf injected)");
  expect(snippet("Python", "http://127.0.0.1:17420", 1, schema)).toContain(
    "json=json.loads(",
  );
  expect(snippet("Python", "http://127.0.0.1:17420", 1, schema)).not.toContain(
    "False",
  );
  expect(snippet("cURL", "http://127.0.0.1:17420", 1, schema)).toContain(
    "$JEV_CLIENT_TOKEN",
  );
});
