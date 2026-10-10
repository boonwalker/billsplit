import { chromium } from "playwright-core";
import { spawn } from "node:child_process";
const SP = process.argv[2];
const ROOT = new URL("..", import.meta.url).pathname; // Repo-Wurzel (Server läuft aus dist-server/)
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const PORT = 3273;
const srv = spawn("node", ["dist-server/index.js"], { cwd: ROOT, env: { ...process.env, PORT: String(PORT), DATA_DIR: SP + "/data-live" }, stdio: "ignore" });
try {
await wait(1500);
const call = (path, key, method, body) => fetch(`http://localhost:${PORT}${path}`, { method, headers: { "content-type": "application/json", "x-billsplit-key": key }, body: body && JSON.stringify(body) }).then((r) => r.json());
const NIK = "nikkey-1234567890abcdefghij", BEN = "benkey-1234567890abcdefghij";
const data = { title: "REWE", date: "2026-10-10", currency: "EUR", equalSplit: true, tipSplitCount: 2, items: [{ id: "a", name: "Creme Brulee", qty: 1, total: 140 }, { id: "b", name: "Spezi", qty: 1, total: 1094 }], tipPercent: 0, payment: { paypalMe: "nik" } };
const id = (await call("/api/bills", NIK, "POST", { name: "Niklas", data })).id;
await call(`/api/bills/${id}/join`, BEN, "POST", { name: "Ben" });
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH ?? "/opt/pw-browsers/chromium-1194/chrome-linux/chrome" });
const ctxFor = async (key, name, role) => {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, locale: "de-DE", colorScheme: "dark" });
  await ctx.addInitScript(([k, n, r, i]) => { localStorage.setItem("billsplit.deviceKey", JSON.stringify(k)); localStorage.setItem("billsplit.profile", JSON.stringify({ name: n, paypalMe: n.toLowerCase(), paypalEmail: "" })); localStorage.setItem("billsplit.recent", JSON.stringify([{ id: i, title: "REWE", role: r, createdAt: "2026-10-10T18:00:00Z" }])); }, [key, name, role, id]);
  return ctx;
};
const nikCtx = await ctxFor(NIK, "Niklas", "owner");
const nik = await nikCtx.newPage();
await nik.goto(`http://localhost:${PORT}/#/b/${id}`); await nik.waitForSelector(".live-dot.on"); await wait(800);
console.log("owner badge alone:", (await nik.locator(".live-dot").innerText()).replace(/\n/g, " "));
const benCtx = await ctxFor(BEN, "Ben", "guest");
const ben = await benCtx.newPage();
await ben.goto(`http://localhost:${PORT}/#/dashboard`); await ben.waitForSelector(".balance-ring"); await wait(1500);
console.log("owner badge with Ben in the app:", (await nik.locator(".live-dot").innerText()).replace(/\n/g, " "));
await nik.locator(".topbar").screenshot({ path: `${SP}/shots/live-badge.png` });
console.log("ben dashboard before:", (await ben.locator(".balance-legend").innerText()).replace(/\n/g, " | "));
// Owner crosses out the Creme Brulee on the live bill
await nik.locator('.receipt li[data-item="a"] .rline-main').scrollIntoViewIfNeeded();
await nik.locator('.receipt li[data-item="a"] .rline-main').click(); await wait(1800);
console.log("ben dashboard after (no reload):", (await ben.locator(".balance-legend").innerText()).replace(/\n/g, " | "));
await benCtx.close();
await wait(14000);
console.log("owner badge after Ben closed the app:", (await nik.locator(".live-dot").innerText()).replace(/\n/g, " "));
await browser.close();
} finally { srv.kill(); }
