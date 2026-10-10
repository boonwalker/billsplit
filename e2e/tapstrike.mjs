import { chromium } from "playwright-core";
import { spawn } from "node:child_process";
const SP = process.argv[2];
const ROOT = new URL("..", import.meta.url).pathname; // Repo-Wurzel (Server läuft aus dist-server/)
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const srv = spawn("node", ["dist-server/index.js"], { cwd: ROOT, env: { ...process.env, PORT: "3226", DATA_DIR: SP + "/data-tapstrike" }, stdio: "ignore" });
await wait(1500);
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH ?? "/opt/pw-browsers/chromium-1194/chrome-linux/chrome" });
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, locale: "de-DE", hasTouch: true });
await ctx.addInitScript(() => localStorage.setItem("billsplit.profile", JSON.stringify({ name: "Niklas", paypalMe: "niklasb", paypalEmail: "" })));
const page = await ctx.newPage();
await page.route("**/api/parse-receipt", (route) => route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({
  merchant: "REWE City", date: "2026-10-09", currency: "EUR",
  items: [{ name: "Spaghetti 500g", qty: 2, total: 258 }, { name: "Mini Gurke", qty: 1, total: 114 }, { name: "Vollmilch 1l", qty: 1, total: 120 }, { name: "Tortilla Chips", qty: 1, total: 189 }],
  total: 681, tip: null, fees: [], delivery: false, supermarket: true, engine: "ai" }) }));
await page.goto("http://localhost:3226/");
await page.locator(".action-card.primary input[type=file]").setInputFiles(`${SP}/shots/app-receipt.png`);
await page.waitForSelector(".sheet h2", { timeout: 15000 });
await page.getByRole("button", { name: "Manches nicht" }).click();
await page.locator(".scribble-foot").getByRole("button", { name: "Rechnung erstellen" }).click();
await page.waitForSelector(".receipt .rline", { timeout: 15000 });
await wait(1500);
const sum = () => page.locator(".fraction").getAttribute("aria-label");
console.log("before:", await sum());
const line = page.locator('.receipt .rline:has-text("Vollmilch")');
await line.scrollIntoViewIfNeeded();
const box = await line.locator(".rline-main").boundingBox();
await page.mouse.move(box.x + 60, box.y + box.height / 2);
await page.mouse.down();
await wait(200);
console.log("holding:", await line.getAttribute("class"));
await page.locator(".receipt-lines").screenshot({ path: `${SP}/shots/tapstrike-hold.png` });
await page.mouse.up();
await wait(900);
console.log("after tap:", await line.getAttribute("class"), await sum());
await page.locator(".receipt").screenshot({ path: `${SP}/shots/tapstrike-after.png` });
await page.reload();
await page.waitForSelector(".receipt .rline");
await wait(1200);
console.log("after reload:", await page.locator('.receipt .rline:has-text("Vollmilch")').getAttribute("class"), await sum());
await page.locator('.receipt .rline:has-text("Vollmilch") .rline-main').click();
await wait(900);
console.log("restored:", await page.locator('.receipt .rline:has-text("Vollmilch")').getAttribute("class"), await sum());
await browser.close();
srv.kill();
