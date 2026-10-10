import { chromium } from "playwright-core";
import { spawn } from "node:child_process";
const SP = process.argv[2];
const ROOT = new URL("..", import.meta.url).pathname; // Repo-Wurzel (Server läuft aus dist-server/)
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const srv = spawn("node", ["dist-server/index.js"], { cwd: ROOT, env: { ...process.env, PORT: "3222", DATA_DIR: SP + "/data-touch" }, stdio: "ignore" });
await wait(1500);
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH ?? "/opt/pw-browsers/chromium-1194/chrome-linux/chrome" });
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, locale: "de-DE", hasTouch: true, isMobile: true });
await ctx.addInitScript(() => localStorage.setItem("billsplit.profile", JSON.stringify({ name: "Niklas", paypalMe: "niklasb", paypalEmail: "" })));
const page = await ctx.newPage();
page.on("pageerror", (e) => console.log("pageerror", e.message));
const items = Array.from({ length: 14 }, (_, i) => ({ name: ["Spaghetti", "Tomaten", "Mozzarella", "Basilikum", "Chips", "Bier", "Wasser", "Brot", "Butter", "Käse", "Salami", "Oliven", "Duschgel", "Gurke"][i], qty: 1, total: 100 + i * 10 }));
await page.route("**/api/parse-receipt", (route) => route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({
  merchant: "REWE City", date: "2026-10-09", currency: "EUR", items, total: items.reduce((s, i) => s + i.total, 0), tip: null, fees: [], delivery: false, supermarket: true, engine: "ai" }) }));
await page.goto("http://localhost:3222/");
await page.locator(".action-card.primary input[type=file]").setInputFiles(`${SP}/shots/app-receipt.png`);
await page.waitForSelector(".sheet h2", { timeout: 15000 });
await page.getByRole("button", { name: "Manches nicht" }).click();
await wait(1000);
const cdp = await ctx.newCDPSession(page);
async function swipe(x1, y1, x2, y2, steps = 12) {
  await cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ x: x1, y: y1 }] });
  for (let i = 1; i <= steps; i++) {
    await cdp.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: [{ x: x1 + ((x2 - x1) * i) / steps, y: y1 + ((y2 - y1) * i) / steps }] });
    await wait(16);
  }
  await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
}
const scrollTop = () => page.locator(".scribble-scroll").evaluate((e) => e.scrollTop);
const lineY = async (t) => {
  const li = page.locator(".scribble li[data-item]", { hasText: t });
  await li.evaluate((e) => e.scrollIntoView({ block: "center" }));
  await wait(300);
  const b = await li.boundingBox();
  return b.y + b.height / 2;
};
const area = await page.locator(".scribble-scroll").boundingBox();
console.log("scroll area:", Math.round(area.y), Math.round(area.y + area.height));
console.log("scrollTop before:", await scrollTop());
await swipe(200, area.y + area.height - 30, 204, area.y + 40);
await wait(1300);
console.log("scrollTop after up-swipe:", await scrollTop(), "| struck:", await page.locator(".scribble li.done").count());
let y = await lineY("Butter");
await swipe(60, y, 330, y + 6);
await wait(1300);
console.log("after sideways stroke on Butter:", (await page.locator(".scribble li.done").allInnerTexts()).map((t) => t.split("\n")[0]));
y = await lineY("Käse");
await swipe(80, y + 12, 200, y - 14);
await wait(1300);
console.log("after slanted stroke on Käse:", (await page.locator(".scribble li.done").allInnerTexts()).map((t) => t.split("\n")[0]));
y = await lineY("Salami");
await page.touchscreen.tap(120, y);
await wait(400);
console.log("after tap on Salami:", (await page.locator(".scribble li.done").allInnerTexts()).map((t) => t.split("\n")[0]));
await page.touchscreen.tap(120, y);
await wait(400);
console.log("after 2nd tap:", (await page.locator(".scribble li.done").allInnerTexts()).map((t) => t.split("\n")[0]), "|", await page.locator(".scribble-notice").innerText());
await browser.close();
srv.kill();
