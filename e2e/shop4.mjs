import { chromium } from "playwright-core";
import { spawn } from "node:child_process";
const SP = process.argv[2];
const ROOT = new URL("..", import.meta.url).pathname; // Repo-Wurzel (Server läuft aus dist-server/)
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const srv = spawn("node", ["dist-server/index.js"], { cwd: ROOT, env: { ...process.env, PORT: "3225", DATA_DIR: SP + "/data-shop4" }, stdio: "ignore" });
await wait(1500);
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH ?? "/opt/pw-browsers/chromium-1194/chrome-linux/chrome" });
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, locale: "de-DE" });
await ctx.addInitScript(() => localStorage.setItem("billsplit.profile", JSON.stringify({ name: "Niklas", paypalMe: "niklasb", paypalEmail: "" })));
const page = await ctx.newPage();
page.on("pageerror", (e) => console.log("pageerror", e.message));
await page.route("**/api/parse-receipt", (route) => route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({
  merchant: "REWE City", date: "2026-10-09", currency: "EUR",
  items: [{ name: "Spaghetti 500g", qty: 2, total: 258 }, { name: "Mini Gurke", qty: 1, total: 114 }, { name: "Balea Duschgel", qty: 1, total: 195, personal: true }, { name: "Vollmilch 1l", qty: 1, total: 120 }, { name: "Tortilla Chips", qty: 1, total: 189 }],
  total: 876, tip: null, fees: [], delivery: false, supermarket: true, engine: "ai" }) }));
await page.goto("http://localhost:3225/");
await page.locator(".action-card.primary input[type=file]").setInputFiles(`${SP}/shots/app-receipt.png`);
await page.waitForSelector(".sheet h2", { timeout: 15000 });
await page.getByRole("button", { name: "Manches nicht" }).click();
await wait(900);
console.log("order:", (await page.locator(".scribble .receipt-lines").innerText()).replace(/\n+/g, " | "));
const box = async (t) => page.locator(".scribble li[data-item]", { hasText: t }).boundingBox();
// strike Duschgel: screenshot while the finger is still down
let b = await box("Duschgel");
const y = b.y + b.height / 2;
await page.mouse.move(b.x + 6, y + 2); await page.mouse.down();
await page.mouse.move(b.x + b.width * 0.5, y - 3, { steps: 10 });
await page.mouse.move(b.x + b.width - 8, y + 1, { steps: 10 });
await page.locator(".scribble-scroll").screenshot({ path: `${SP}/shots/shop4-drawing.png` });
await page.mouse.up();
await wait(1100); // read after the pause, ink fading into the strike
await page.locator(".scribble-scroll").screenshot({ path: `${SP}/shots/shop4-fading.png` });
await wait(1200);
// a steep diagonal on the milk, a short vertical stroke on the chips
b = await box("Vollmilch");
await page.mouse.move(b.x + 120, b.y + b.height - 4); await page.mouse.down(); await page.mouse.move(b.x + 150, b.y + 4, { steps: 8 }); await page.mouse.up();
await wait(1200);
await page.locator(".scribble li[data-item]", { hasText: "Tortilla" }).evaluate((e) => e.scrollIntoView({ block: "center" })); await wait(300);
b = await box("Tortilla");
await page.mouse.move(b.x + 200, b.y + 8); await page.mouse.down(); await page.mouse.move(b.x + 203, b.y + b.height - 8, { steps: 6 }); await page.mouse.up();
await wait(1200);
console.log("notice:", await page.locator(".scribble-notice").innerText());
console.log("struck:", (await page.locator(".scribble li.done").allInnerTexts()).map((t) => t.split("\n")[0]));
// tap Spaghetti: pressed animation
b = await box("Spaghetti");
await page.mouse.click(b.x + 60, b.y + b.height / 2);
await wait(140);
console.log("pressed class:", await page.locator(".scribble li.pressed").count());
await page.locator(".scribble-scroll").screenshot({ path: `${SP}/shots/shop4-press.png` });
await wait(800);
await page.locator(".scribble-scroll").screenshot({ path: `${SP}/shots/shop4-after.png` });
await page.screenshot({ path: `${SP}/shots/shop4-full.png` });
await browser.close();
srv.kill();
