import { chromium } from "playwright-core";
import { spawn } from "node:child_process";
const SP = process.argv[2];
const ROOT = new URL("..", import.meta.url).pathname; // Repo-Wurzel (Server läuft aus dist-server/)
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const srv = spawn("node", ["dist-server/index.js"], { cwd: ROOT, env: { ...process.env, PORT: "3238", DATA_DIR: SP + "/data-review" }, stdio: "ignore" });
await wait(1500);
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH ?? "/opt/pw-browsers/chromium-1194/chrome-linux/chrome" });
for (const [label, items] of [["erkannt", [{ name: "Pizza", qty: 1, total: 1000 }]], ["nichts erkannt", []]]) {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, locale: "de-DE", deviceScaleFactor: 2 });
  await ctx.addInitScript(() => localStorage.setItem("billsplit.profile", JSON.stringify({ name: "Niklas", paypalMe: "nik", paypalEmail: "" })));
  const page = await ctx.newPage();
  await page.route("**/api/parse-receipt", (route) => route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ merchant: "REWE City", date: "2017-06-23", currency: "EUR", items, total: 9999, tip: null, fees: [], delivery: false, supermarket: false, engine: "ai" }) }));
  await page.goto("http://localhost:3238/");
  await page.locator(".action-card.primary input[type=file]").setInputFiles(`${SP}/shots/app-receipt.png`);
  await page.waitForSelector(".field input[type=date]", { timeout: 15000 });
  await wait(500);
  const card = await page.locator(".field input[type=date]").evaluate((el) => { const c = el.closest(".card").getBoundingClientRect(), r = el.getBoundingClientRect(); return { inputRight: Math.round(r.right), cardRight: Math.round(c.right) }; });
  console.log(label, "→ buttons:", await page.locator(".capture-row label").allTextContents(), "| alert:", await page.locator(".alert").allTextContents(), "| date:", card);
  await page.screenshot({ path: `${SP}/shots/review-${items.length}.png` });
  await ctx.close();
}
await browser.close();
srv.kill();
