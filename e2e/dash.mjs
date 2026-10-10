import { chromium } from "playwright-core";
import { spawn } from "node:child_process";
const SP = process.argv[2];
const ROOT = new URL("..", import.meta.url).pathname; // Repo-Wurzel (Server läuft aus dist-server/)
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const srv = spawn("node", ["dist-server/index.js"], { cwd: ROOT, env: { ...process.env, PORT: "3269", DATA_DIR: SP + "/data-dash" }, stdio: "ignore" });
await wait(1500);
const call = (path, key, method, body) => fetch(`http://localhost:3269${path}`, { method, headers: { "content-type": "application/json", "x-billsplit-key": key }, body: body && JSON.stringify(body) }).then((r) => r.json());
const ME = "mekey-1234567890abcdefghij", ANNA = "annakey-1234567890abcdefgh", BEN = "benkey-1234567890abcdefghi";
const items = [{ id: "a", name: "Pizza", qty: 1, total: 1290 }, { id: "b", name: "Pasta", qty: 1, total: 1150 }, { id: "c", name: "Wein", qty: 1, total: 2400 }];
const pay = { paypalMe: "x" };
// 1: I paid, Anna has pasta, Ben has wine (not yet)
const b1 = (await call("/api/bills", ME, "POST", { name: "Niklas", data: { title: "Trattoria", date: "2026-10-09", currency: "EUR", items, tipPercent: 10, payment: pay } })).id;
await call(`/api/bills/${b1}/claims`, ME, "PUT", { claims: { a: [0] } });
await call(`/api/bills/${b1}/join`, ANNA, "POST", { name: "Anna" }); await call(`/api/bills/${b1}/claims`, ANNA, "PUT", { claims: { b: [0] } });
await call(`/api/bills/${b1}/join`, BEN, "POST", { name: "Ben" }); await call(`/api/bills/${b1}/claims`, BEN, "PUT", { claims: { c: [0] } });
// 2: Anna paid, I had the pizza
const b2 = (await call("/api/bills", ANNA, "POST", { name: "Anna", data: { title: "Sushi Bar", date: "2026-10-08", currency: "EUR", items, tipPercent: 0, payment: pay } })).id;
await call(`/api/bills/${b2}/join`, ME, "POST", { name: "Niklas" }); await call(`/api/bills/${b2}/claims`, ME, "PUT", { claims: { a: [0], c: [0] } });
// 3: Lisa paid, I had pasta and marked as paid
const b3 = (await call("/api/bills", "lisakey-1234567890abcdefgh", "POST", { name: "Lisa", data: { title: "Café", date: "2026-10-07", currency: "EUR", items, tipPercent: 0, payment: pay } })).id;
await call(`/api/bills/${b3}/join`, ME, "POST", { name: "Niklas" }); await call(`/api/bills/${b3}/claims`, ME, "PUT", { claims: { b: [0] } });
const recent = [
  { id: b1, title: "Trattoria", role: "owner", createdAt: "2026-10-09T18:00:00Z" },
  { id: b2, title: "Sushi Bar", role: "guest", createdAt: "2026-10-08T18:00:00Z" },
  { id: b3, title: "Café", role: "guest", createdAt: "2026-10-07T18:00:00Z" },
];
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH ?? "/opt/pw-browsers/chromium-1194/chrome-linux/chrome" });
for (const scheme of ["light", "dark"]) {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, locale: "de-DE", colorScheme: scheme });
  await ctx.addInitScript(([k, r]) => { localStorage.setItem("billsplit.deviceKey", JSON.stringify(k)); localStorage.setItem("billsplit.profile", JSON.stringify({ name: "Niklas", paypalMe: "nik", paypalEmail: "" })); localStorage.setItem("billsplit.recent", JSON.stringify(r)); }, [ME, recent]);
  const p = await ctx.newPage();
  await p.goto("http://localhost:3269/"); await wait(1200);
  if (scheme === "light") await p.locator(".dashboard-btn").screenshot({ path: `${SP}/shots/dash-btn.png` });
  await p.locator(".dashboard-btn").click(); await p.waitForSelector(".balance-ring"); await wait(1200);
  if (scheme === "light") console.log((await p.locator("main").innerText()).replace(/\n/g, " | "));
  await p.screenshot({ path: `${SP}/shots/dash-${scheme}.png`, fullPage: true });
  if (scheme === "light") { await p.locator(".balance-legend-row").nth(1).click(); await wait(300); console.log("tap owed:", (await p.locator(".balance-ring-centre").innerText()).replace(/\n/g, " | ")); }
  await ctx.close();
}
await browser.close(); srv.kill();
