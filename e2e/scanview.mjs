import { chromium } from "playwright-core";
import { spawn } from "node:child_process";
const SP = process.argv[2];
const ROOT = new URL("..", import.meta.url).pathname; // Repo-Wurzel (Server läuft aus dist-server/)
const IMG = process.argv[3] ?? `${SP}/shots/app-receipt.png`;
const TAG = process.argv[4] ?? "a";
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const srv = spawn("node", ["dist-server/index.js"], { cwd: ROOT, env: { ...process.env, PORT: "3228", DATA_DIR: SP + "/data-scanview" }, stdio: "ignore" });
await wait(1500);
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH ?? "/opt/pw-browsers/chromium-1194/chrome-linux/chrome" });
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, locale: "de-DE" });
await ctx.addInitScript(() => localStorage.setItem("billsplit.profile", JSON.stringify({ name: "Andy", paypalMe: "andy", paypalEmail: "" })));
const page = await ctx.newPage();
await page.route("**/api/parse-receipt", async (route) => { await wait(9000); route.fulfill({ status: 500, body: "{}" }); });
await page.goto("http://localhost:3228/");
await page.locator(".action-card.primary input[type=file]").setInputFiles(IMG);
await page.waitForSelector(".scan-photo-img", { timeout: 15000 });
await wait(300);
const box = await page.locator(".scan-photo").boundingBox();
console.log("photo box", box);
for (const t of [0, 500, 1000, 1500, 2100, 2600]) {
  if (t) await wait(500);
  await page.screenshot({ path: `${SP}/shots/scan-${TAG}-${t}.png` });
}
await browser.close();
srv.kill();
