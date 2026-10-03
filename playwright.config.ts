import { defineConfig } from "@playwright/test";

// E2E runs against the real Worker in mock mode (no API key), serving the built site.
// Uses the Chrome already installed on the machine (no browser download).
export default defineConfig({
  testDir: "tests/e2e",
  timeout: 90_000,
  expect: { timeout: 20_000 },
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: [["list"]],
  use: {
    baseURL: "http://127.0.0.1:8788",
    channel: "chrome",
    headless: true,
    acceptDownloads: true,
    trace: "retain-on-failure",
  },
  webServer: {
    command: "npm run build && npm run serve:e2e",
    url: "http://127.0.0.1:8788/api/config",
    reuseExistingServer: true,
    timeout: 180_000,
  },
});
