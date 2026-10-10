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
