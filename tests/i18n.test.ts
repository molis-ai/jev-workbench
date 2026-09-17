import { it, expect } from "vitest";
import english from "../apps/web/src/en.json";

it("English UI strings are unique so language switch can reverse-lookup Chinese", () => {
  const seen = new Map<string, string>();
  for (const [zh, en] of Object.entries(english)) {
    const prev = seen.get(en);
    expect(prev, `duplicate English ${JSON.stringify(en)} for ${JSON.stringify(zh)} and ${JSON.stringify(prev)}`).toBeUndefined();
    seen.set(en, zh);
  }
});
