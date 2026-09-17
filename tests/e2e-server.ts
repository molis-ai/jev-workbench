import { createApp } from "../apps/server/src/app";
import { fixture } from "./fixture";
import { mkdtempSync, writeFileSync, mkdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
const home = mkdtempSync(join(tmpdir(), "jev-browser-"));
const state = await createApp({
  home,
  port: 17425,
  provider: fixture,
  testMode: true,
});
await state.app.listen({ host: "127.0.0.1", port: 17425 });
mkdirSync(".playwright", { recursive: true });
writeFileSync(".playwright/bootstrap", state.sessions.bootstrap(), {
  mode: 0o600,
});
writeFileSync(".playwright/home", home, { mode: 0o600 });
process.on("SIGTERM", async () => {
  await state.app.close();
  process.exit(0);
});
