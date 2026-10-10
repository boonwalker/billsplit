import { describe, expect, it } from "vitest";
import { isPushEndpoint, PushService } from "../server/push";
import { BillStore } from "../server/store";

const sub = (host: string) => ({ endpoint: `https://${host}/push/abc`, keys: { p256dh: "p", auth: "a" } });

describe("push notifications", () => {
  it("only sends to the browsers' push services", () => {
    expect(isPushEndpoint("https://web.push.apple.com/QGx")).toBe(true);
    expect(isPushEndpoint("https://fcm.googleapis.com/fcm/send/x")).toBe(true);
    expect(isPushEndpoint("https://updates.push.services.mozilla.com/wpush/v2/x")).toBe(true);
    expect(isPushEndpoint("http://web.push.apple.com/x")).toBe(false);
    expect(isPushEndpoint("https://example.com/push")).toBe(false);
    expect(isPushEndpoint("https://push.apple.com.evil.example/x")).toBe(false);
  });

  it("delivers a notice to every device of the person and forgets devices that are gone", async () => {
    const sent: [string, string][] = [];
    const push = new PushService(null, (async (s: { endpoint: string }, payload: string) => {
      sent.push([new URL(s.endpoint).hostname, payload]);
      if (s.endpoint.includes("fcm")) throw Object.assign(new Error("gone"), { statusCode: 410 });
      return { statusCode: 201, body: "", headers: {} };
    }) as never);
    await push.init();
    expect(push.publicKey).toMatch(/^[A-Za-z0-9_-]{80,}$/);
    push.subscribe("katia", sub("web.push.apple.com"));
    push.subscribe("katia", sub("fcm.googleapis.com"));

    // A settlement payment to Katia reaches her devices through the store's notices.
    const store = new BillStore(null);
    store.onNotice((pid, notice) => void push.notify(pid, notice));
    const bill = store.createBill(
      { title: "Kino", date: "", currency: "EUR", tipPercent: 0, payment: {}, items: [{ id: "t", name: "Ticket", qty: 1, total: 900 }] },
      "katia",
      "Katia",
    );
    store.join(bill, "me", "Niklas");
    store.setClaims(bill, "me", { t: [0] });
    store.createTransfer("me", { toId: "katia", amount: 900, currency: "EUR", allocations: [{ billId: bill, debtorId: "me", creditorId: "katia", amount: 900 }] });
    await new Promise((r) => setTimeout(r, 10));

    expect(sent.map(([host]) => host).sort()).toEqual(["fcm.googleapis.com", "web.push.apple.com"]);
    expect(JSON.parse(sent[0][1])).toMatchObject({ title: expect.stringContaining("Niklas hat Dir 9,00"), path: "/dashboard" });
    expect(push.has("katia", sub("web.push.apple.com").endpoint)).toBe(true);
    expect(push.has("katia", sub("fcm.googleapis.com").endpoint)).toBe(false);
  });
});
