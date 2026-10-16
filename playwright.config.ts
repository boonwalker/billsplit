import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { defineConfig } from "@playwright/test";

/**
 * The fixed click tests (e2e/specs): the core flows in a phone-sized Chromium against the
 * built server (`npm run build` first) with an empty data folder. Run: `npm run test:e2e`.
 */
const PORT = 4173;
// The config is loaded again in every test worker: they inherit the folder of the main process.
const DATA_DIR = (process.env.E2E_DATA_DIR ??= mkdtempSync(path.join(tmpdir(), "billsplit-e2e-")));
// Sign-in codes land in this file instead of a mailbox (see server/mail.ts); the tests read it.
process.env.MAIL_OUTBOX = path.join(DATA_DIR, "outbox.jsonl");
// Fixed exchange rates instead of the ECB's (the server is pointed nowhere and keeps these).
writeFileSync(path.join(DATA_DIR, "rates.json"), JSON.stringify({ date: "2026-10-15", source: "ECB", rates: { EUR: 1, USD: 1.08, GBP: 0.85 } }));

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
      DATA_DIR,
      MAIL_OUTBOX: process.env.MAIL_OUTBOX,
      ECB_RATES_URL: "http://127.0.0.1:9/keine-kurse",
      // The app's address; 127.0.0.1 plays the old one (move.e2e.ts).
      PUBLIC_URL: `http://localhost:${PORT}`,
      RESEND_API_KEY: "",
      // The whole suite creates more bills than one person would in an hour.
      BILL_LIMIT_PER_HOUR: "500",
      // The admin page (admin.e2e.ts).
      ADMIN_TOKEN: "e2e-admin-token-123456",
      OPERATOR_NAME: "Erika Muster",
      OPERATOR_ADDRESS: "Musterweg 1, 12345 Musterstadt",
      OPERATOR_EMAIL: "hallo@example.org",
      // No AI in tests (and no costs).
      ANTHROPIC_API_KEY: "",
    },
  },
});
