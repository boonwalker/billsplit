import { chromium } from "playwright-core";
import { spawn } from "node:child_process";
const SP = process.argv[2];
const ROOT = new URL("..", import.meta.url).pathname; // Repo-Wurzel (Server läuft aus dist-server/)
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const srv = spawn("node", ["dist-server/index.js"], { cwd: ROOT, env: { ...process.env, PORT: "3213", DATA_DIR: SP + "/data-shop3" }, stdio: "ignore" });
await wait(1500);
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH ?? "/opt/pw-browsers/chromium-1194/chrome-linux/chrome" });
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, locale: "de-DE" });
await ctx.addInitScript(() => localStorage.setItem("billsplit.profile", JSON.stringify({ name: "Niklas", paypalMe: "niklasb", paypalEmail: "" })));
const page = await ctx.newPage();
page.on("pageerror", (e) => console.log("pageerror", e.message));
await page.route("**/api/parse-receipt", (route) => route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({
  merchant: "REWE Markt", date: "2026-10-09", currency: "EUR",
  items: [{ name: "Duschgel", qty: 1, total: 195 }, { name: "Vollmilch 1l", qty: 1, total: 120 }, { name: "Spaghetti 500g", qty: 2, total: 258 }, { name: "Mini Gurke", qty: 1, total: 114 }],
  total: 687, tip: null, fees: [], delivery: false, supermarket: true, engine: "ai" }) }));
await page.goto("http://localhost:3213/");
await page.locator(".action-card.primary input[type=file]").setInputFiles(`${SP}/shots/app-receipt.png`);
await page.waitForSelector(".sheet h2", { timeout: 15000 });
await page.getByRole("button", { name: "Manches nicht" }).click();
await wait(1500);
await page.screenshot({ path: `${SP}/shots/shop3-demo1.png` });
await wait(3600);
await page.screenshot({ path: `${SP}/shots/shop3-demo3.png` });
async function stroke(pts) {
  await page.mouse.move(pts[0][0], pts[0][1]); await page.mouse.down();
  for (const [x, y] of pts.slice(1)) await page.mouse.move(x, y, { steps: 8 });
  await page.mouse.up();
}
const box = async (t) => page.locator(".shop-paper li", { hasText: t }).boundingBox();
let b = await box("Duschgel");
await stroke([[b.x + 5, b.y + b.height / 2 + 2], [b.x + b.width / 2, b.y + b.height / 2 - 2], [b.x + b.width - 5, b.y + b.height / 2 + 1]]);
await wait(1200);
console.log("notice1:", await page.locator(".scribble-notice").innerText());
// a scribble that is not a strike-through
b = await box("Vollmilch");
await stroke([[b.x + 150, b.y + b.height / 2 + 12], [b.x + 160, b.y + b.height / 2 - 12]]);
await wait(1200);
console.log("scribble:", await page.locator(".scribble-notice").innerText());
// tap the name of the milk: divided by the head count
await page.mouse.click(b.x + 40, b.y + b.height / 2); await wait(400);
console.log("notice2:", await page.locator(".scribble-notice").innerText());
console.log("sum:", await page.locator(".scribble-sum").innerText());
// tap the price of "Mini Gurke" without a head count, then set 2 people
const gp = await page.locator(".shop-paper li", { hasText: "Mini Gurke" }).locator(".rline-price").boundingBox();
await page.mouse.click(gp.x + gp.width / 2, gp.y + gp.height / 2); await wait(400);
console.log("notice3:", await page.locator(".scribble-notice").innerText());
await page.getByRole("button", { name: "Eine Person mehr" }).click();
await wait(300);
console.log("gurke line:", (await page.locator(".shop-paper li", { hasText: "Mini Gurke" }).innerText()).replace(/\n+/g, " | "));
// tap the crossed-out Duschgel to bring it back
const dg = await page.locator(".shop-paper li", { hasText: "Duschgel" }).boundingBox();
await page.mouse.click(dg.x + 60, dg.y + dg.height / 2); await wait(400);
console.log("notice4:", await page.locator(".scribble-notice").innerText(), "| struck:", await page.locator(".shop-paper li.done").count());
console.log("sum2:", await page.locator(".scribble-sum").innerText());
await page.screenshot({ path: `${SP}/shots/shop3-marked.png` });

await page.locator(".scribble .btn-primary").click();
await page.waitForURL(/#\/b\//, { timeout: 10000 }); await wait(1200);
console.log("bill lines:", (await page.locator(".receipt-lines").innerText()).replace(/\n+/g, " | "));
await browser.close();
srv.kill();
