import { chromium } from "playwright-core";
import { spawn } from "node:child_process";
const SP = process.argv[2];
const ROOT = new URL("..", import.meta.url).pathname; // Repo-Wurzel (Server läuft aus dist-server/)
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const PORT = 3271;
const srv = spawn("node", ["dist-server/index.js"], { cwd: ROOT, env: { ...process.env, PORT: String(PORT), DATA_DIR: SP + "/data-tri" }, stdio: "ignore" });
await wait(1500);
const call = (path, key, method, body) => fetch(`http://localhost:${PORT}${path}`, { method, headers: { "content-type": "application/json", "x-billsplit-key": key }, body: body && JSON.stringify(body) }).then((r) => r.json());
const ME = "mekey-1234567890abcdefghij", ANDY = "andykey-1234567890abcdefgh", KATIA = "katiakey-1234567890abcdefg";
const bill = (title, items, pay) => ({ title, date: "2026-10-10", currency: "EUR", items, tipPercent: 0, payment: pay });
const pizzeria = (await call("/api/bills", ANDY, "POST", { name: "Andy", data: bill("Pizzeria", [{ id: "p", name: "Pizza", qty: 1, total: 500 }], { paypalMe: "andy" }) })).id;
await call(`/api/bills/${pizzeria}/join`, ME, "POST", { name: "Niklas" }); await call(`/api/bills/${pizzeria}/claims`, ME, "PUT", { claims: { p: [0] } });
const kino = (await call("/api/bills", KATIA, "POST", { name: "Katia", data: bill("Kino", [{ id: "t", name: "Ticket", qty: 1, total: 500 }, { id: "c", name: "Popcorn", qty: 1, total: 300 }], { paypalMe: "katia" }) })).id;
await call(`/api/bills/${kino}/join`, ANDY, "POST", { name: "Andy" }); await call(`/api/bills/${kino}/claims`, ANDY, "PUT", { claims: { t: [0] } });
await call(`/api/bills/${kino}/join`, ME, "POST", { name: "Niklas" }); await call(`/api/bills/${kino}/claims`, ME, "PUT", { claims: { c: [0] } });

const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH ?? "/opt/pw-browsers/chromium-1194/chrome-linux/chrome" });
async function as(key, name, recent) {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, locale: "de-DE", permissions: ["clipboard-read", "clipboard-write"] });
  await ctx.addInitScript(([k, n, r]) => { localStorage.setItem("billsplit.deviceKey", JSON.stringify(k)); localStorage.setItem("billsplit.profile", JSON.stringify({ name: n, paypalMe: n.toLowerCase(), paypalEmail: "" })); localStorage.setItem("billsplit.recent", JSON.stringify(r)); }, [key, name, recent]);
  return { ctx, page: await ctx.newPage() };
}
const recent = (role1, role2) => [{ id: kino, title: "Kino", role: role2, createdAt: "2026-10-10T19:00:00Z" }, { id: pizzeria, title: "Pizzeria", role: role1, createdAt: "2026-10-10T18:00:00Z" }];

// 1. Me: plan with one payment to Katia
const me = await as(ME, "Niklas", recent("guest", "guest"));
me.ctx.on("request", (r) => { if (r.method() === "POST") console.log("REQ", r.method(), r.url().replace(/.*\/api/, "/api"), r.postData()?.slice(0, 60)); });
await me.page.goto(`http://localhost:${PORT}/#/dashboard`); await me.page.waitForSelector(".plan-card"); await wait(800);
console.log("plan:", (await me.page.locator(".plan-card").innerText()).replace(/\n/g, " | "));
await me.page.screenshot({ path: `${SP}/shots/tri-plan.png`, fullPage: true });
await me.page.locator(".plan-pay").first().click(); await wait(300);
console.log("sheet:", (await me.page.locator(".settle-sheet").innerText()).replace(/\n/g, " | "));
await me.page.locator(".settle-sheet").screenshot({ path: `${SP}/shots/tri-sheet.png` });
await me.page.getByRole("button", { name: /an Katia zahlen/ }).click(); await wait(200);
const link = me.page.getByRole("link", { name: /Mit PayPal bezahlen/ });
console.log("paypal:", await link.getAttribute("href"));
const [pop] = await Promise.all([me.ctx.waitForEvent("page"), link.click()]); await pop.close();
await me.page.getByRole("button", { name: /Gesendet – Katia bestätigen lassen/ }).click();
await me.page.waitForSelector(".settle-done", { timeout: 10000 });
console.log("done:", await me.page.locator(".settle-done").innerText());
await me.page.getByRole("button", { name: "Fertig" }).click(); await wait(1200);
console.log("me inbox:", (await me.page.locator(".transfer-inbox").innerText()).replace(/\n/g, " | "));
console.log("me plan after:", await me.page.locator(".plan-card").count());

console.log("katia transfers api:", JSON.stringify((await call("/api/transfers", KATIA, "GET")).transfers.map((t) => [t.id, t.createdAt, t.amount])));
await browser.close(); srv.kill(); process.exit(0);
// 2. Andy: sees it, and in Katia's bill nothing to pay any more
const andy = await as(ANDY, "Andy", recent("owner", "guest"));
await andy.page.goto(`http://localhost:${PORT}/#/dashboard`); await andy.page.waitForSelector(".transfer-inbox", { timeout: 10000 }); await wait(800);
console.log("andy inbox:", (await andy.page.locator(".transfer-inbox").innerText()).replace(/\n/g, " | "));
await andy.page.goto(`http://localhost:${PORT}/#/b/${kino}`); await andy.page.waitForSelector(".paybar"); await wait(800);
console.log("andy paybar in Kino:", (await andy.page.locator(".paybar").innerText()).replace(/\n/g, " | "));

// 3. Katia: badge on home, confirms
const katia = await as(KATIA, "Katia", recent("guest", "owner"));
await katia.page.goto(`http://localhost:${PORT}/`); await wait(1500);
console.log("katia home button:", await katia.page.locator(".dashboard-btn").innerText());
await katia.page.locator(".dashboard-btn").click(); await katia.page.waitForSelector(".inbox-card.incoming"); await wait(600);
console.log("katia inbox:", (await katia.page.locator(".inbox-card.incoming").innerText()).replace(/\n/g, " | "));
await katia.page.screenshot({ path: `${SP}/shots/tri-katia.png`, fullPage: true });
await katia.page.getByRole("button", { name: "✓ Erhalten" }).click(); await wait(1500);
console.log("katia inbox after:", await katia.page.locator(".inbox-card.incoming").count());
await katia.page.goto(`http://localhost:${PORT}/#/b/${kino}`); await katia.page.waitForSelector(".owner-panel"); await wait(800);
console.log("katia owner panel:", (await katia.page.locator(".owner-panel").innerText()).replace(/\n/g, " | "));

const net = await call("/api/network", ME, "GET");
console.log("open shares left (me):", JSON.stringify(net.edges.map((e) => [e.title, e.debtorName, e.amount])));
const pz = await call(`/api/bills/${pizzeria}`, ANDY, "GET");
console.log("Andy's pizzeria panel: credited", pz.debtors[0].credited, "| missing ->", pz.debtors[0].creditNotes);
await browser.close(); srv.kill();
