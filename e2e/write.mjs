import { chromium } from "playwright-core";
import { spawn } from "node:child_process";
const SP = process.argv[2];
const ROOT = new URL("..", import.meta.url).pathname; // Repo-Wurzel (Server läuft aus dist-server/)
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const srv = spawn("node", ["dist-server/index.js"], { cwd: ROOT, env: { ...process.env, PORT: "3202", DATA_DIR: SP + "/data-write" }, stdio: "ignore" });
await wait(1500);
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH ?? "/opt/pw-browsers/chromium-1194/chrome-linux/chrome" });
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, locale: "de-DE" });
await ctx.addInitScript(() => localStorage.setItem("billsplit.profile", JSON.stringify({ name: "Niklas", paypalMe: "niklasb", paypalEmail: "" })));
const page = await ctx.newPage();
page.on("pageerror", (e) => console.log("pageerror", e.message));
await page.route("**/api/parse-receipt", (route) => route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({
  merchant: "REWE Markt", date: "2026-10-09", currency: "EUR",
  items: [{ name: "Vollmilch 1l", qty: 1, total: 120 }, { name: "Spaghetti 500g", qty: 2, total: 258 }, { name: "Olivenöl", qty: 1, total: 699 }],
  total: 1077, tip: null, fees: [], delivery: false, supermarket: true, engine: "ai" }) }));
await page.goto("http://localhost:3202/");
await page.locator(".action-card.primary input[type=file]").setInputFiles(`${SP}/shots/app-receipt.png`);
await page.waitForSelector(".shop-items", { timeout: 15000 });
await page.locator(".sheet").getByRole("button", { name: "QR-Code erstellen" }).click();
await page.waitForURL(/#\/b\//, { timeout: 10000 }); await wait(1500);
await page.getByRole("button", { name: "✏️ Schreiben" }).click(); await wait(300);
await page.locator(".rline", { hasText: "Olivenöl" }).evaluate((e) => e.scrollIntoView({ block: "center" })); await wait(400);
console.log("writing:", await page.locator(".receipt-lines-wrap.writing").count(), "canvas:", await page.locator(".ink-layer").count());
const oil = await page.locator(".rline", { hasText: "Olivenöl" }).boundingBox();
console.log("oil box:", JSON.stringify(oil));
const cy = oil.y + oil.height / 2;
async function stroke(pts) {
  await page.mouse.move(pts[0][0], pts[0][1]); await page.mouse.down();
  for (const [x, y] of pts.slice(1)) await page.mouse.move(x, y, { steps: 6 });
  await page.mouse.up();
}
// "/" then "3", roughly on the olive oil line
await stroke([[150, cy + 16], [168, cy - 18]]);
await stroke([[180, cy - 14], [192, cy - 19], [204, cy - 13], [200, cy - 3], [190, cy], [203, cy + 5], [205, cy + 14], [193, cy + 19], [179, cy + 14]]);
await wait(1500);
console.log("toast:", await page.locator(".toast").innerText());
console.log("oil line:", (await page.locator(".rline", { hasText: "Olivenöl" }).innerText()).replace(/\n+/g, " | "));
await page.locator(".receipt-anchor").screenshot({ path: `${SP}/shots/write.png` });
await page.getByRole("button", { name: "Rückgängig" }).click(); await wait(800);
console.log("after undo:", (await page.locator(".rline", { hasText: "Olivenöl" }).innerText()).replace(/\n+/g, " | "));
await browser.close();
srv.kill();
