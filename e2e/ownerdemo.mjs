import { chromium } from "playwright-core";
import { spawn } from "node:child_process";
const SP = process.argv[2];
const ROOT = new URL("..", import.meta.url).pathname; // Repo-Wurzel (Server läuft aus dist-server/)
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const srv = spawn("node", ["dist-server/index.js"], { cwd: ROOT, env: { ...process.env, PORT: "3243", DATA_DIR: SP + "/data-ownerdemo" }, stdio: "ignore" });
await wait(1500);
const OK = "ownerkey-1234567890abcdef";
const mk = (equalSplit) => fetch("http://localhost:3243/api/bills", { method: "POST", headers: { "content-type": "application/json", "x-billsplit-key": OK }, body: JSON.stringify({ name: "Niklas", data: { title: "Takumi", date: "2026-10-10", currency: "EUR", items: [{ id: "a", name: "Takoyaki", qty: 1, total: 650 }, { id: "b", name: "Ramen Shoyu", qty: 2, total: 2480 }, { id: "c", name: "Edamame", qty: 1, total: 490 }, { id: "d", name: "Asahi", qty: 3, total: 1350 }], tipPercent: 0, payment: { paypalMe: "nik" }, equalSplit } }) }).then((r) => r.json());
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH ?? "/opt/pw-browsers/chromium-1194/chrome-linux/chrome" });
for (const equal of [false, true]) {
  const { id } = await mk(equal);
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, locale: "de-DE" });
  await ctx.addInitScript(() => { localStorage.setItem("billsplit.profile", JSON.stringify({ name: "Niklas", paypalMe: "nik", paypalEmail: "" })); localStorage.setItem("billsplit.deviceKey", JSON.stringify("ownerkey-1234567890abcdef")); });
  const p = await ctx.newPage();
  await p.goto(`http://localhost:3243/#/b/${id}`); await p.waitForSelector(".qr-hero"); await wait(4000);
  const sel = equal ? ".bill-demo" : ".claim-demo";
  console.log(equal ? "equal" : "normal", "– before scrolling:", await p.locator(sel).count(), "| flag:", await p.evaluate((id) => Object.keys(localStorage).filter((k) => k.includes(id)), id));
  await p.locator(".receipt-lines li[data-item]").nth(2).scrollIntoViewIfNeeded(); await p.evaluate(() => document.querySelector(".bill-scroll").scrollBy(0, 150));
  await wait(equal ? 5300 : 3300);
  console.log("   after scrolling:", await p.locator(sel).count());
  await p.locator(".receipt-lines-wrap").screenshot({ path: `${SP}/shots/owner-demo-${equal}.png` });
  await ctx.close();
}
await browser.close(); srv.kill();
