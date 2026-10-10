import { chromium } from "playwright-core";
import { spawn } from "node:child_process";
import { readdirSync } from "node:fs";
const SP = process.argv[2];
const ROOT = new URL("..", import.meta.url).pathname; // Repo-Wurzel (Server läuft aus dist-server/)
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const srv = spawn("node", ["dist-server/index.js"], { cwd: ROOT, env: { ...process.env, PORT: "3197", DATA_DIR: SP + "/data-orig" }, stdio: "ignore" });
await wait(1500);
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH ?? "/opt/pw-browsers/chromium-1194/chrome-linux/chrome" });
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, locale: "de-DE" });
await ctx.addInitScript(() => localStorage.setItem("billsplit.profile", JSON.stringify({ name: "Niklas", paypalMe: "niklasb", paypalEmail: "" })));
const page = await ctx.newPage();
page.on("pageerror", (e) => console.log("pageerror", e.message));
await page.route("**/api/parse-receipt", (route) => route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({
  merchant: "Sushi Sana", date: "2026-10-09", currency: "EUR",
  items: [{ name: "Ramen Shoyu", qty: 2, total: 2480 }, { name: "Edamame", qty: 1, total: 490 }],
  total: 2970, tip: 300, fees: [], delivery: false, engine: "ai" }) }));
await page.goto("http://localhost:3197/");
await page.locator(".action-card.secondary input[type=file]").setInputFiles(`${SP}/shots/app-receipt.png`);
await page.waitForURL(/#\/b\//, { timeout: 15000 });
await wait(1500);
console.log("link visible:", await page.getByRole("button", { name: "Zum Originalbeleg" }).isVisible());
console.log("stored files:", readdirSync(`${SP}/data-orig/receipts`));
await page.getByRole("button", { name: "Zum Originalbeleg" }).scrollIntoViewIfNeeded();
console.log("link color:", await page.locator(".receipt-original").evaluate((e) => getComputedStyle(e).color), "qty color:", await page.locator(".rline-qty").first().evaluate((e) => getComputedStyle(e).color));
await page.locator(".receipt-paper").screenshot({ path: `${SP}/shots/orig-link.png` });
const billUrl = page.url();
await page.getByRole("button", { name: "Zum Originalbeleg" }).click();
await wait(1000);
console.log("route:", page.url(), "| img loaded:", await page.locator(".original-photo").evaluate((i) => i.naturalWidth));
await page.screenshot({ path: `${SP}/shots/orig-page.png` });
await page.getByRole("button", { name: "In voller Größe anzeigen" }).first().click(); await wait(400);
await page.screenshot({ path: `${SP}/shots/orig-full.png` });
console.log("viewer open:", await page.getByRole("dialog").count());
await page.getByRole("button", { name: "Schließen" }).click(); await wait(300);
console.log("after x:", await page.getByRole("dialog").count());
await page.locator(".original-full").click(); await wait(300);
await page.mouse.move(195, 420); await page.mouse.down(); await page.mouse.move(195, 500, { steps: 5 }); await page.mouse.move(195, 600, { steps: 5 }); await page.mouse.up(); await wait(300);
console.log("after swipe down:", await page.getByRole("dialog").count());
await page.locator(".original-full").click(); await wait(300);
await page.mouse.move(195, 420); await page.mouse.down(); await page.mouse.move(195, 380, { steps: 5 }); await page.mouse.up(); await wait(300);
console.log("after small drag (stays):", await page.getByRole("dialog").count());
await page.mouse.dblclick(195, 420); await wait(400);
console.log("transform after double tap:", await page.locator(".photo-viewer-stage img").evaluate((i) => i.style.transform));
// a friend can see it too
const ctx2 = await browser.newContext({ viewport: { width: 390, height: 844 }, locale: "de-DE" });
await ctx2.addInitScript(() => localStorage.setItem("billsplit.profile", JSON.stringify({ name: "Anna", paypalMe: "", paypalEmail: "" })));
const p2 = await ctx2.newPage();
await p2.goto(billUrl); await wait(1500);
console.log("friend sees link:", await p2.getByRole("button", { name: "Zum Originalbeleg" }).isVisible());
await browser.close();
srv.kill();
