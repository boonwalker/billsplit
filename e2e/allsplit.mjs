import { chromium } from "playwright-core";
import { spawn } from "node:child_process";
const SP = process.argv[2];
const ROOT = new URL("..", import.meta.url).pathname; // Repo-Wurzel (Server läuft aus dist-server/)
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const srv = spawn("node", ["dist-server/index.js"], { cwd: ROOT, env: { ...process.env, PORT: "3229", DATA_DIR: SP + "/data-allsplit" }, stdio: "ignore" });
await wait(1500);
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH ?? "/opt/pw-browsers/chromium-1194/chrome-linux/chrome" });
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, locale: "de-DE" });
await ctx.addInitScript(() => localStorage.setItem("billsplit.profile", JSON.stringify({ name: "Andy", paypalMe: "andy", paypalEmail: "" })));
const page = await ctx.newPage();
await page.route("**/api/parse-receipt", (route) => route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({
  merchant: "REWE City", date: "2017-06-23", currency: "EUR",
  items: [{ name: "Spruehsahne", qty: 2, total: 198 }, { name: "Vanille", qty: 1, total: 199 }],
  total: 397, tip: null, fees: [], delivery: false, supermarket: true, engine: "ai" }) }));
await page.goto("http://localhost:3229/");
await page.locator(".action-card.primary input[type=file]").setInputFiles(`${SP}/shots/app-receipt.png`);
await page.waitForSelector(".sheet h2", { timeout: 15000 });
await page.getByRole("button", { name: "Alles aufteilen" }).click();
await page.getByRole("button", { name: "Eine Person mehr" }).click();
await page.getByRole("button", { name: "Eine Person mehr" }).click();
await wait(300);
await page.locator(".sheet").screenshot({ path: `${SP}/shots/allsplit.png` });
await page.locator(".sheet").getByRole("button", { name: "Rechnung erstellen" }).click();
await page.waitForSelector(".receipt .rline", { timeout: 15000 });
await wait(1000);
console.log("equal:", await page.locator(".rline.equal").count(), await page.locator(".fraction").getAttribute("aria-label"));
await browser.close();
srv.kill();
