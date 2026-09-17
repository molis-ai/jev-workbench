import { defineConfig } from "@playwright/test";
export default defineConfig({
  testDir: "tests/e2e",
  workers: 1,
  use: {
    baseURL: "http://127.0.0.1:17425",
    viewport: { width: 1440, height: 960 },
    trace: "retain-on-failure",
  },
  webServer: {
    command: "pnpm exec tsx tests/e2e-server.ts",
    url: "http://127.0.0.1:17425/health/live",
    reuseExistingServer: false,
  },
  reporter: "list",
});
