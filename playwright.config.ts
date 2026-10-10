import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { defineConfig } from "@playwright/test";

/**
 * The fixed click tests (e2e/specs): the core flows in a phone-sized Chromium against the
 * built server (`npm run build` first) with an empty data folder. Run: `npm run test:e2e`.
 */
const PORT = 4173;

export default defineConfig({
  testDir: "e2e/specs",
  testMatch: "*.e2e.ts",
  workers: 1,
  timeout: 60_000,
  expect: { timeout: 8_000 },
  reporter: process.env.CI ? [["list"], ["html", { open: "never" }]] : "list",
  use: {
    baseURL: `http://localhost:${PORT}`,
    browserName: "chromium",
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 2,
    isMobile: true,
    hasTouch: true,
    locale: "de-DE",
    trace: "retain-on-failure",
    launchOptions: process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {},
  },
  webServer: {
    command: "node dist-server/index.js",
    url: `http://localhost:${PORT}/api/health`,
    reuseExistingServer: false,
    env: {
      PORT: String(PORT),
      DATA_DIR: mkdtempSync(path.join(tmpdir(), "billsplit-e2e-")),
      // No AI in tests (and no costs).
      ANTHROPIC_API_KEY: "",
    },
  },
});
