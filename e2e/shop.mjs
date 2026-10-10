import { chromium } from "playwright-core";
import { spawn } from "node:child_process";
const SP = process.argv[2];
const ROOT = new URL("..", import.meta.url).pathname; // Repo-Wurzel (Server läuft aus dist-server/)
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const srv = spawn("node", ["dist-server/index.js"], { cwd: ROOT, env: { ...process.env, PORT: "3200", DATA_DIR: SP + "/data-shop" }, stdio: "ignore" });
await wait(1500);
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH ?? "/opt/pw-browsers/chromium-1194/chrome-linux/chrome" });
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, locale: "de-DE" });
await ctx.addInitScript(() => localStorage.setItem("billsplit.profile", JSON.stringify({ name: "Niklas", paypalMe: "niklasb", paypalEmail: "" })));
const page = await ctx.newPage();
page.on("pageerror", (e) => console.log("pageerror", e.message));
await page.route("**/api/parse-receipt", (route) => route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({
  merchant: "REWE Markt", date: "2026-10-09", currency: "EUR",
  items: [{ name: "Vollmilch 3,5% 1l", qty: 1, total: 119 }, { name: "Spaghetti 500g", qty: 2, total: 258 }, { name: "Tomaten passiert", qty: 1, total: 89 }, { name: "Duschgel", qty: 1, total: 195 }],
  total: 661, tip: null, fees: [], delivery: false, supermarket: true, engine: "ai" }) }));
await page.goto("http://localhost:3200/");
await page.locator(".action-card.primary input[type=file]").setInputFiles(`${SP}/shots/app-receipt.png`);
await page.waitForSelector(".shop-items", { timeout: 15000 });
await page.screenshot({ path: `${SP}/shots/shop-sheet.png` });
const milk = page.locator(".shop-item", { hasText: "Vollmilch" });
await milk.getByRole("radio", { name: "Teilweise" }).click();
await milk.getByRole("button", { name: "¼" }).click();
await page.locator(".shop-item", { hasText: "Duschgel" }).getByRole("radio", { name: "Nicht" }).click();
await page.getByRole("button", { name: "Eine Person mehr" }).click();
await page.getByRole("button", { name: "Eine Person mehr" }).click();
console.log("sum:", await page.locator(".shop-sum").innerText(), "|", await page.locator(".sheet .muted.small").innerText());
await page.locator(".sheet").screenshot({ path: `${SP}/shots/shop-sheet2.png` });
await page.locator(".sheet").getByRole("button", { name: "QR-Code erstellen" }).click();
await page.waitForURL(/#\/b\//, { timeout: 10000 }); await wait(1500);
console.log("lines:", (await page.locator(".receipt-lines").innerText()).replace(/\n+/g, " | "));
console.log("equal:", await page.getByRole("switch", { name: /Gleichverteilung/ }).getAttribute("aria-checked"));
await browser.close();
srv.kill();
