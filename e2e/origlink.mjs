import { chromium } from "playwright-core";
import { spawn } from "node:child_process";
const SP = process.argv[2];
const ROOT = new URL("..", import.meta.url).pathname; // Repo-Wurzel (Server läuft aus dist-server/)
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const srv = spawn("node", ["dist-server/index.js"], { cwd: ROOT, env: { ...process.env, PORT: "3230", DATA_DIR: SP + "/data-orig" }, stdio: "ignore" });
await wait(1500);
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH ?? "/opt/pw-browsers/chromium-1194/chrome-linux/chrome" });
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, locale: "de-DE", hasTouch: true });
await ctx.addInitScript(() => localStorage.setItem("billsplit.profile", JSON.stringify({ name: "Andy", paypalMe: "andy", paypalEmail: "" })));
const page = await ctx.newPage();
const names = ["Fri. Alpenmilch 3,8%", "Pfand 0,25 7%EM", "Dt. Markenbutter", "Caffè Crema Classic", "Bio Eier 10er", "Toastbrot", "Bananen", "Gouda jung", "Tomaten Rispe", "Duschgel", "Klopapier 8 Rollen", "Nudeln Penne"];
await page.route("**/api/parse-receipt", (route) => route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({
  merchant: "REWE", date: "2026-08-17", currency: "EUR",
  items: names.map((name, i) => ({ name, qty: 1, total: 100 + i * 37, personal: i === 0 || i >= 9 && i <= 10 })),
  total: names.reduce((s, _, i) => s + 100 + i * 37, 0), tip: null, fees: [], delivery: false, supermarket: true, engine: "ai" }) }));
await page.goto("http://localhost:3230/");
await page.locator(".action-card.primary input[type=file]").setInputFiles(`${SP}/shots/app-receipt.png`);
await page.waitForSelector(".sheet h2", { timeout: 15000 });
await page.getByRole("button", { name: "Manches nicht" }).click();
await wait(1200);
const link = page.locator(".scribble .receipt-original");
await link.scrollIntoViewIfNeeded();
await page.screenshot({ path: `${SP}/shots/orig-1.png` });
await link.click();
await page.waitForSelector(".photo-viewer img");
await wait(500);
await page.screenshot({ path: `${SP}/shots/orig-2.png` });
await page.locator(".photo-viewer-close").click();
await wait(300);
console.log("viewer closed:", await page.locator(".photo-viewer").count() === 0, "still marking:", await page.locator(".scribble").count());
await browser.close();
srv.kill();
