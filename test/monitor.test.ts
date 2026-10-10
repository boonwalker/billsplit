import { createServer, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createApp } from "../server/app";
import { costOf, Monitor } from "../server/monitor";
import { BillStore } from "../server/store";

describe("monitor", () => {
  it("adds up calls, tokens and cost per day", () => {
    const monitor = new Monitor(null, () => new Date("2026-10-10T12:00:00Z"));
    monitor.receipt();
    monitor.aiCall({ model: "claude-opus-5-5", inputTokens: 3000, outputTokens: 1500 });
    monitor.aiCall({ model: "claude-opus-5-5", inputTokens: 1000, outputTokens: 500, cacheReadTokens: 2000 });
    monitor.aiFailure("Belegerkennung fehlgeschlagen (529).");
    const [day] = monitor.stats().days;
    expect(day).toMatchObject({ day: "2026-10-10", receipts: 1, aiCalls: 2, aiFailures: 1, inputTokens: 6000, outputTokens: 2000 });
    // 4000 × 4 $ + 2000 × 20 $ + 2000 × 0,20 $ per million tokens
    expect(day.costUsd).toBeCloseTo((4000 * 4 + 2000 * 20 + 2000 * 0.2) / 1e6, 8);
    expect(monitor.stats().errors[0]).toMatchObject({ source: "ai", message: "Belegerkennung fehlgeschlagen (529)." });
    expect(costOf({ model: "unknown", inputTokens: 1e6, outputTokens: 0 })).toBe(4);
  });
});

describe("admin page and error reports", () => {
  let server: Server;
  let base: string;
  const monitor = new Monitor(null);
  const TOKEN = "admin-token-123456";

  beforeAll(async () => {
    server = createServer(createApp(new BillStore(null), "/nonexistent", { monitor, adminToken: TOKEN }));
    await new Promise<void>((resolve) => server.listen(0, resolve));
    base = `http://localhost:${(server.address() as AddressInfo).port}`;
  });
  afterAll(() => new Promise<void>((resolve) => server.close(() => resolve())));

  it("records errors from the app and shows them only with the token", async () => {
    const res = await fetch(`${base}/api/client-error`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ message: "TypeError: x is <undefined>", path: "#/dashboard", device: "iPhone" }),
    });
    expect(res.status).toBe(200);
    expect((await fetch(`${base}/api/admin`)).status).toBe(404);
    expect((await fetch(`${base}/api/admin?token=wrong-token-123456`)).status).toBe(404);
    const page = await fetch(`${base}/api/admin?token=${TOKEN}`);
    const html = await page.text();
    expect(page.headers.get("content-type")).toContain("text/html");
    expect(html).toContain("TypeError: x is &lt;undefined&gt; (#/dashboard)");
    expect(html).toContain("Speicher: memory");
  });
});
