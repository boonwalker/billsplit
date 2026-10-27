import { mkdtempSync, writeFileSync } from "node:fs";
import { createServer, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createApp } from "../server/app";
import { BillStore } from "../server/store";
import { VisitLog } from "../server/visits";

const TOKEN = "admin-token-for-tests-123";

describe("printed links (QR code on the beer mats)", () => {
  const visits = new VisitLog(null);
  let server: Server;
  let base: string;

  beforeAll(async () => {
    const dist = mkdtempSync(path.join(tmpdir(), "billsplit-printed-"));
    writeFileSync(path.join(dist, "index.html"), "<html><head></head><body></body></html>");
    server = createServer(createApp(new BillStore(null), dist, { visits, adminToken: TOKEN }));
    await new Promise<void>((resolve) => server.listen(0, resolve));
    base = `http://localhost:${(server.address() as AddressInfo).port}`;
  });
  afterAll(() => new Promise<void>((resolve) => server.close(() => resolve())));

  it("counts klicksplit.de/koeln and leads to the start page", async () => {
    for (const p of ["/koeln", "/koeln/", "/Koeln"]) {
      const res = await fetch(base + p, { redirect: "manual" });
      expect(res.status).toBe(302);
      expect(res.headers.get("location")).toBe("/");
    }
    await fetch(`${base}/koeln`, { method: "HEAD", redirect: "manual" });
    expect(visits.stats()[0].sources).toEqual({ koeln: 3 });
    // Other paths stay the app.
    expect((await fetch(`${base}/koelnisch`, { redirect: "manual" })).status).toBe(200);
  });

  it("shows the scans on the admin page", async () => {
    const page = await (await fetch(`${base}/api/admin?token=${TOKEN}`)).text();
    expect(page).toContain("Bierdeckel-Scans");
    expect(page).toMatch(/Bierdeckel-Scans<\/span><b>3<\/b>/);
  });
});
