import { chromium } from "playwright-core";
import { spawn } from "node:child_process";
const SP = process.argv[2];
const ROOT = new URL("..", import.meta.url).pathname; // Repo-Wurzel (Server läuft aus dist-server/)
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const srv = spawn("node", ["dist-server/index.js"], { cwd: ROOT, env: { ...process.env, PORT: "3270", DATA_DIR: SP + "/data-settle" }, stdio: "ignore" });
await wait(1500);
const call = (path, key, method, body) => fetch(`http://localhost:3270${path}`, { method, headers: { "content-type": "application/json", "x-billsplit-key": key }, body: body && JSON.stringify(body) }).then((r) => r.json());
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
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, locale: "de-DE", permissions: ["clipboard-read", "clipboard-write"] });
await ctx.addInitScript(([k, r]) => { localStorage.setItem("billsplit.deviceKey", JSON.stringify(k)); localStorage.setItem("billsplit.profile", JSON.stringify({ name: "Niklas", paypalMe: "nik", paypalEmail: "" })); localStorage.setItem("billsplit.recent", JSON.stringify(r)); }, [ME, recent]);
const p = await ctx.newPage();
await p.goto("http://localhost:3270/#/dashboard"); await p.waitForSelector(".person-ring"); await wait(800);
const tile = (n) => p.locator(".person-ring").filter({ hasText: n });
// Anna: I owe 36,90 in her bill, she owes 13,11 in mine
await tile("Anna").locator(".person-ring-hit").click(); await wait(300);
console.log("sheet:", (await p.locator(".settle-sheet").innerText()).replace(/\n/g, " | "));
await p.locator(".settle-sheet").screenshot({ path: `${SP}/shots/settle-anna.png` });
await p.getByRole("button", { name: /Ausgleich zahlen/ }).click(); await wait(200);
const link = p.getByRole("link", { name: /Mit PayPal bezahlen/ });
console.log("paypal url:", await link.getAttribute("href"));
const [popup] = await Promise.all([ctx.waitForEvent("page"), link.click()]); await popup.close();
await wait(300);
console.log("question:", await p.locator(".settle-question").innerText());
await p.getByRole("button", { name: /Bezahlt – in/ }).click();
await p.waitForSelector(".settle-done", { timeout: 10000 });
console.log("done:", (await p.locator(".settle-sheet").innerText()).replace(/\n/g, " | "));
await p.getByRole("button", { name: "Fertig" }).click(); await wait(1200);
console.log("anna tile after:", (await tile("Anna").innerText()).replace(/\n/g, " | "));
// verify in the bills
const s2 = await call(`/api/bills/${b2}`, ANNA, "GET");
console.log("Anna's bill, Niklas:", JSON.stringify(s2.debtors.find((d) => d.name === "Niklas"), ["amount", "payAmount", "markedPaidAt", "received"]));
const s1 = await call(`/api/bills/${b1}`, ME, "GET");
console.log("my bill, Anna:", JSON.stringify(s1.debtors.find((d) => d.name === "Anna"), ["amount", "received"]));
const s1a = await call(`/api/bills/${b1}`, ANNA, "GET");
console.log("Anna sees my bill: myReceived", s1a.myReceived);
// Lisa: stale check – my share changes while paying
await tile("Lisa").locator(".person-ring-hit").click(); await wait(300);
await p.getByRole("button", { name: /Ausgleich zahlen/ }).click(); await wait(200);
const [pop2] = await Promise.all([ctx.waitForEvent("page"), p.getByRole("link", { name: /Mit PayPal bezahlen/ }).click()]); await pop2.close();
await call(`/api/bills/${b3}/claims`, ME, "PUT", { claims: { b: [0], a: [0] } });
await p.getByRole("button", { name: /Bezahlt – in/ }).click(); await wait(1500);
console.log("stale:", (await p.locator(".settle-sheet .alert").innerText()), "| total now:", await p.locator(".settle-total").innerText());
const s3 = await call(`/api/bills/${b3}`, "lisakey-1234567890abcdefgh", "GET");
console.log("Lisa's bill untouched:", JSON.stringify(s3.debtors[0], ["markedPaidAt", "payAmount"]));
await browser.close(); srv.kill();
