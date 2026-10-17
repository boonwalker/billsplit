import { mkdtempSync, writeFileSync } from "node:fs";
import { createServer, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createApp } from "../server/app";
import { previewBillId } from "../server/preview";
import { BillStore } from "../server/store";

describe("link previews (WhatsApp & co.)", () => {
  const store = new BillStore(null);
  let server: Server;
  let base: string;
  let bill: string;

  beforeAll(async () => {
    const dist = mkdtempSync(path.join(tmpdir(), "billsplit-preview-"));
    writeFileSync(path.join(dist, "index.html"), "<html><head><title>klicksplit</title></head><body></body></html>");
    bill = store.createBill(
      { title: "Trattoria <Roma>", date: "2026-10-17", currency: "EUR", tipPercent: 0, payment: {}, items: [{ id: "a", name: "Pizza", qty: 1, total: 950 }] },
      "niklas",
      "Niklas",
    );
    server = createServer(createApp(store, dist, { homeUrl: "https://www.klicksplit.de" }));
    await new Promise<void>((resolve) => server.listen(0, resolve));
    base = `http://localhost:${(server.address() as AddressInfo).port}`;
  });
  afterAll(() => new Promise<void>((resolve) => server.close(() => resolve())));

  it("shows a shared bill's title and who paid – escaped, without amounts", async () => {
    const html = await (await fetch(`${base}/b/${bill}?to=nik`)).text();
    expect(html).toContain('<meta property="og:title" content="Trattoria &lt;Roma&gt; · Niklas hat bezahlt">');
    expect(html).toContain('<meta property="og:image" content="https://www.klicksplit.de/og.png">');
    expect(html).not.toContain("9,50");
  });

  it("in the reader's language, and the general picture elsewhere", async () => {
    const en = await (await fetch(`${base}/b/${bill}`, { headers: { "accept-language": "en-US" } })).text();
    expect(en).toContain("Trattoria &lt;Roma&gt; · Niklas paid");
    const home = await (await fetch(`${base}/`)).text();
    expect(home).toContain("klicksplit – Einer zahlt. Alle splitten.");
    const unknown = await (await fetch(`${base}/b/doesnotexist`)).text();
    expect(unknown).toContain("klicksplit – Einer zahlt. Alle splitten.");
  });

  it("only takes bill paths", () => {
    expect(previewBillId("/b/AbCdEf123")).toBe("AbCdEf123");
    expect(previewBillId("/b/AbCdEf123/edit")).toBeNull();
    expect(previewBillId("/assets/x.js")).toBeNull();
  });
});
