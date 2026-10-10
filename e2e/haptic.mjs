import { chromium } from "playwright-core";
import { spawn } from "node:child_process";
const SP = process.argv[2];
const ROOT = new URL("..", import.meta.url).pathname; // Repo-Wurzel (Server läuft aus dist-server/)
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const srv = spawn("node", ["dist-server/index.js"], { cwd: ROOT, env: { ...process.env, PORT: "3232", DATA_DIR: SP + "/data-haptic" }, stdio: "ignore" });
await wait(1500);
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH ?? "/opt/pw-browsers/chromium-1194/chrome-linux/chrome" });
const owner = await browser.newContext({ locale: "de-DE" });
await owner.addInitScript(() => {
  localStorage.setItem("billsplit.profile", JSON.stringify({ name: "Andy", paypalMe: "andy", paypalEmail: "" }));
  localStorage.setItem("billsplit.deviceKey", JSON.stringify("ownerkey-1234567890abcdef"));
  window.__haptics = [];
  Navigator.prototype.vibrate = function (p) { window.__haptics.push(JSON.stringify(p)); return true; };
});
const op = await owner.newPage();
await op.goto("http://localhost:3232/");
const res = await fetch("http://localhost:3232/api/bills", { method: "POST", headers: { "content-type": "application/json", "x-billsplit-key": "ownerkey-1234567890abcdef" }, body: JSON.stringify({ name: "Andy", data: { title: "Test", date: "2026-10-09", currency: "EUR", items: [{ id: "a", name: "Pizza", qty: 1, total: 1000 }], tipPercent: 0, payment: { paypalMe: "andy" } } }) });
const created = await res.json();
const id = created.id ?? JSON.stringify(created);
console.log("bill", id);
await op.goto(`http://localhost:3232/#/b/${id}`);
await op.waitForSelector(".qr-hero");
await wait(800);
for (const ios of [false, true]) {
  const ctx = await browser.newContext({ locale: "de-DE" });
  await ctx.addInitScript((ios) => {
    localStorage.setItem("billsplit.profile", JSON.stringify({ name: ios ? "Ben" : "Anna", paypalMe: "", paypalEmail: "" }));
    window.__haptics = [];
    if (ios) { delete Navigator.prototype.vibrate; document.addEventListener("change", (e) => e.target.matches?.("input[switch]") && window.__haptics.push("tick@" + Math.round(performance.now())), true); }
    else Navigator.prototype.vibrate = function (p) { window.__haptics.push(JSON.stringify(p)); return true; };
  }, ios);
  const p = await ctx.newPage();
  await p.goto(`http://localhost:3232/#/b/${id}`);
  await p.waitForSelector(".paybar", { timeout: 10000 }).catch(() => {});
  await wait(800);
  await p.screenshot({ path: SP + "/shots/haptic-" + ios + ".png" }); console.log(p.url());
  console.log("paybar", await p.locator(".paybar").count(), await p.locator(".guest-intro").textContent().catch(()=>"-"));
  console.log(ios ? "ios:" : "android:", await p.evaluate(() => window.__haptics));
  await p.locator(".receipt .rline-main").first().click(); await wait(600); await p.evaluate(() => (window.__haptics = []));
  await p.locator(".paybar .btn-paypal").dispatchEvent("pointerdown");
  await p.locator(".paybar .btn-paypal").click();
  await wait(300);
  console.log(" after Anteil begleichen:", await p.evaluate(() => window.__haptics), await p.locator(".paybar .btn-paypal").textContent());
  await p.evaluate(() => (window.__haptics = []));
  await p.reload(); await wait(1200);
  console.log(" after reload (already joined):", await p.evaluate(() => window.__haptics));
  await ctx.close();
}
await wait(500);
console.log("owner haptics:", await op.evaluate(() => window.__haptics));
await browser.close();
srv.kill();
