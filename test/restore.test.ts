import { mkdtempSync, writeFileSync } from "node:fs";
import { createServer, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createApp } from "../server/app";
import { AuditLog } from "../server/audit";
import { BillStore } from "../server/store";
import type { BillData } from "../src/lib/bill";

const TOKEN = "admin-token-for-tests-123";
const data: BillData = {
  title: "C.C. Kowalski",
  date: "2026-10-15",
  currency: "EUR",
  tipPercent: 0,
  payment: { paypalMe: "nik" },
  items: [
    { id: "schnitzel", name: "Wiener Schnitzel", qty: 2, total: 6300 },
    { id: "cola", name: "Fritz Cola", qty: 1, total: 380 },
  ],
};

describe("admin page: a bill's history in the backups, and restoring it", () => {
  const dir = mkdtempSync(path.join(tmpdir(), "billsplit-restore-"));
  const store = new BillStore(path.join(dir, "bills.json"));
  const audit = new AuditLog(null);
  let server: Server;
  let base: string;
  let id: string;

  beforeAll(async () => {
    await store.load();
    const dist = mkdtempSync(path.join(tmpdir(), "billsplit-admin-"));
    writeFileSync(path.join(dist, "index.html"), "<html><head></head><body></body></html>");
    id = store.createBill(data, "nik", "Niklas");
    store.join(id, "anna", "Anna");
    store.setClaims(id, "anna", { schnitzel: [0] });
    store.join(id, "ben", "Ben");
    store.setClaims(id, "ben", { schnitzel: [1] });
    store.join(id, "peter", "Peter");
    store.setClaims(id, "peter", { cola: [0] });
    await store.backup();
    // Afterwards Anna's and Ben's phones are merged into one of them (the log keeps it).
    server = createServer(createApp(store, dist, { adminToken: TOKEN, audit }));
    await new Promise<void>((resolve) => server.listen(0, resolve));
    base = `http://localhost:${(server.address() as AddressInfo).port}`;
    store.mergeParticipant("ben", "anna", { reason: "Anmeldung mit Konto" });
  });
  afterAll(() => new Promise<void>((resolve) => server.close(() => resolve())));

  it("logs the merge", () => {
    expect(audit.list(id)[0].text).toContain("Zusammengelegt (Anmeldung mit Konto): „Ben“ in „Anna“");
  });

  it("shows each backup with who is missing now", async () => {
    expect((await fetch(`${base}/api/admin/restore?token=wrong-token-12345&id=${id}`)).status).toBe(404);
    const page = await (await fetch(`${base}/api/admin/restore?token=${TOKEN}&id=${id}`)).text();
    expect(page).toContain("Sicherung vom");
    expect(page).toContain("Ben (fehlt jetzt)");
    expect(page).toContain("Wiener Schnitzel ×1");
    expect(page).toContain("Zusammengelegt");
  });

  it("puts the bill back as it was – only with the tick", async () => {
    const day = (await store.backups())[0].day;
    const post = (fields: Record<string, string>) =>
      fetch(`${base}/api/admin/restore`, { method: "POST", body: new URLSearchParams({ token: TOKEN, id, day, ...fields }), redirect: "manual" });
    expect(decodeURIComponent((await post({})).headers.get("location")!)).toContain("Nichts geändert");
    expect(store.snapshot(id, "nik").participants.map((p) => p.name)).toEqual(["Niklas", "Anna", "Peter"]);

    const res = await post({ confirm: "ja" });
    expect(decodeURIComponent(res.headers.get("location")!)).toContain(`wieder wie in der Sicherung vom ${day}`);
    const snap = store.snapshot(id, "nik");
    expect(snap.participants.map((p) => p.name)).toEqual(["Niklas", "Anna", "Ben", "Peter"]);
    expect(snap.participants.find((p) => p.id === "ben")?.claims).toEqual({ schnitzel: [1] });
    expect(audit.list(id)[0]).toMatchObject({ kind: "restore" });
  });
});

describe("merging identities: never two people who both paid in a bill", () => {
  it("keeps them apart and logs why", () => {
    const store = new BillStore(null);
    const events: string[] = [];
    store.onAudit((e) => events.push(e.text));
    const id = store.createBill(data, "nik", "Niklas");
    for (const p of ["anna", "ben"]) {
      store.join(id, p, p);
      store.setClaims(id, p, { schnitzel: [p === "anna" ? 0 : 1] });
      store.recordPayClick(id, p);
    }
    expect(store.mergeParticipant("ben", "anna")).toEqual([]);
    expect(store.snapshot(id, "nik").participants).toHaveLength(3);
    expect(events.at(-1)).toContain("Nicht zusammengelegt");
  });
});
