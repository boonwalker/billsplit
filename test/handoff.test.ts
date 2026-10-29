import { createServer, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createApp } from "../server/app";
import { HANDOFF_TTL_MS, HandoffBoard, networkKey } from "../server/handoff";
import { BillStore } from "../server/store";

describe("networkKey", () => {
  it("keeps IPv4 addresses (also IPv4-mapped ones)", () => {
    expect(networkKey("203.0.113.7")).toBe("203.0.113.7");
    expect(networkKey("::ffff:203.0.113.7")).toBe("203.0.113.7");
  });

  it("uses the /64 network of IPv6 addresses", () => {
    expect(networkKey("2001:db8:aa:1:1111:2222:3333:4444")).toBe("2001:db8:aa:1");
    expect(networkKey("2001:0db8:00aa:0001::5")).toBe("2001:db8:aa:1");
    expect(networkKey("2001:db8::1")).toBe("2001:db8:0:0");
  });
});

describe("HandoffBoard", () => {
  it("is pending for the same network until it expires or is cleared", () => {
    let now = 0;
    const board = new HandoffBoard(() => now);
    board.mark("2001:db8:aa:1::abcd");
    expect(board.pending("2001:db8:aa:1:9:9:9:9")).toBe(true);
    expect(board.pending("198.51.100.1")).toBe(false);
    now = HANDOFF_TTL_MS + 1;
    expect(board.pending("2001:db8:aa:1::abcd")).toBe(false);
    board.mark("198.51.100.1");
    board.clear("198.51.100.1");
    expect(board.pending("198.51.100.1")).toBe(false);
  });
});

describe("/api/handoff", () => {
  let server: Server;
  let base: string;
  beforeAll(async () => {
    server = createServer(createApp(new BillStore(null), "/nonexistent"));
    await new Promise<void>((resolve) => server.listen(0, resolve));
    base = `http://localhost:${(server.address() as AddressInfo).port}/api/handoff`;
  });
  afterAll(() => new Promise<void>((resolve) => server.close(() => resolve())));

  it("notes a hand-over from the browser for the app", async () => {
    const pending = async () => ((await (await fetch(base)).json()) as { pending: boolean }).pending;
    expect(await pending()).toBe(false);
    await fetch(base, { method: "POST" });
    expect(await pending()).toBe(true);
    await fetch(base, { method: "DELETE" });
    expect(await pending()).toBe(false);
  });
});

describe("/api/handoff with a bill, /recipient", () => {
  const store = new BillStore(null);
  const NIK = "niklas-device-key-0123456789";
  const STRANGER = "someone-else-key-0123456789";
  let server: Server;
  let base: string;
  let id: string;
  beforeAll(async () => {
    const { participantIdFromKey } = await import("../server/store");
    id = store.createBill({ title: "PiZz", date: "2026-10-29", currency: "EUR", tipPercent: 0, payment: {}, items: [{ id: "a", name: "Pizza", qty: 1, total: 900 }] }, "freddy", "Freddy R.");
    store.join(id, participantIdFromKey(NIK), "Niklas");
    server = createServer(createApp(store, "/nonexistent"));
    await new Promise<void>((resolve) => server.listen(0, resolve));
    base = `http://localhost:${(server.address() as AddressInfo).port}`;
  });
  afterAll(() => new Promise<void>((resolve) => server.close(() => resolve())));

  it("tells the bill only to an app that is in it – everyone else pastes the link as before", async () => {
    await fetch(`${base}/api/handoff`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ billId: id }) });
    const status = async (key: string) => (await (await fetch(`${base}/api/handoff`, { headers: { "x-billsplit-key": key } })).json()) as { pending: boolean; billId?: string };
    expect(await status(NIK)).toEqual({ pending: true, billId: id });
    expect(await status(STRANGER)).toEqual({ pending: true });
  });

  it("names a reminder's recipient (only people in the bill, never the payer)", async () => {
    const { participantIdFromKey } = await import("../server/store");
    const res = await fetch(`${base}/api/bills/${id}/recipient?fuer=${participantIdFromKey(NIK)}`);
    expect(await res.json()).toEqual({ name: "Niklas", app: false });
    expect((await fetch(`${base}/api/bills/${id}/recipient?fuer=freddy`)).status).toBe(404);
    expect((await fetch(`${base}/api/bills/${id}/recipient?fuer=nobody`)).status).toBe(404);
  });
});
