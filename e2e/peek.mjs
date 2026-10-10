import { chromium } from "playwright-core";
import { spawn } from "node:child_process";
const SP = process.argv[2];
const ROOT = new URL("..", import.meta.url).pathname; // Repo-Wurzel (Server läuft aus dist-server/)
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const PORT = 3275;
const srv = spawn("node", ["dist-server/index.js"], { cwd: ROOT, env: { ...process.env, PORT: String(PORT), DATA_DIR: SP + "/data-peek" }, stdio: "ignore" });
try {
await wait(1500);
const call = (path, key, method, body) => fetch(`http://localhost:${PORT}${path}`, { method, headers: { "content-type": "application/json", "x-billsplit-key": key }, body: body && JSON.stringify(body) }).then((r) => r.json());
const NIK = "nikkey-1234567890abcdefghij";
const id = (await call("/api/bills", NIK, "POST", { name: "Niklas", data: { title: "REWE Ridders OHG", date: "2026-10-10", currency: "EUR", equalSplit: true, items: [{ id: "a", name: "Spezi", qty: 1, total: 95 }, { id: "b", name: "Creme Brulee", qty: 1, total: 139 }], tipPercent: 0, payment: { paypalMe: "nik" } } })).id;
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH ?? "/opt/pw-browsers/chromium-1194/chrome-linux/chrome" });
for (const scheme of ["dark", "light"]) {
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, locale: "de-DE", colorScheme: scheme });
await ctx.addInitScript(([k]) => { localStorage.setItem("billsplit.deviceKey", JSON.stringify(k)); localStorage.setItem("billsplit.profile", JSON.stringify({ name: "Niklas", paypalMe: "nik", paypalEmail: "" })); }, [NIK]);
const p = await ctx.newPage();
await p.goto(`http://localhost:${PORT}/#/b/${id}`); await p.waitForSelector(".ownerbar"); await wait(2200);
console.log(scheme, "peek at top:", await p.locator(".receipt-peek").count());
await p.screenshot({ path: `${SP}/shots/peek-${scheme}.png` });
if (scheme === "dark") {
  await p.locator(".receipt-peek").click(); await wait(1500);
  console.log("after tap → peek:", await p.locator(".receipt-peek").count(), "| receipt top:", Math.round((await p.locator(".receipt").boundingBox()).y));
  await p.locator(".bill-scroll").evaluate((el) => el.scrollTo(0, 0)); await wait(1500);
  console.log("back at top → peek:", await p.locator(".receipt-peek").count());
}
await ctx.close();
}
await browser.close();
} finally { srv.kill(); }
