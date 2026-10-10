import { chromium } from "playwright-core";
import { spawn } from "node:child_process";
const SP = process.argv[2];
const ROOT = new URL("..", import.meta.url).pathname; // Repo-Wurzel (Server läuft aus dist-server/)
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const srv = spawn("node", ["dist-server/index.js"], { cwd: ROOT, env: { ...process.env, PORT: "3223", DATA_DIR: SP + "/data-demo5" }, stdio: "ignore" });
await wait(1500);
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH ?? "/opt/pw-browsers/chromium-1194/chrome-linux/chrome" });
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, locale: "de-DE" });
await ctx.addInitScript(() => localStorage.setItem("billsplit.profile", JSON.stringify({ name: "Niklas", paypalMe: "niklasb", paypalEmail: "" })));
const page = await ctx.newPage();
await page.route("**/api/parse-receipt", (route) => route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({
  merchant: "REWE City", date: "2026-10-09", currency: "EUR",
  items: [{ name: "Spaghetti 500g", qty: 2, total: 258 }, { name: "Mini Gurke", qty: 1, total: 114 }, { name: "Balea Duschgel", qty: 1, total: 195, personal: true }, { name: "Vollmilch 1l", qty: 1, total: 120 }, { name: "Tortilla Chips", qty: 1, total: 189 }],
  total: 876, tip: null, fees: [], delivery: false, supermarket: true, engine: "ai" }) }));
await page.goto("http://localhost:3223/");
await page.locator(".action-card.primary input[type=file]").setInputFiles(`${SP}/shots/app-receipt.png`);
await page.waitForSelector(".sheet h2", { timeout: 15000 });
await page.getByRole("button", { name: "Manches nicht" }).click();
const t0 = Date.now();
const at = async (ms, name) => { await wait(ms - (Date.now() - t0)); await page.locator(".scribble-scroll").screenshot({ path: `${SP}/shots/${name}.png` }); };
await at(1600, "demo5-strike");
await at(5500, "demo5-tap1");
await at(7500, "demo5-tap2");
console.log("taps:", await page.locator(".ink-demo-tap-group").count());
await browser.close();
srv.kill();
