import { chromium } from "playwright-core";
import { spawn } from "node:child_process";
const SP = process.argv[2];
const ROOT = new URL("..", import.meta.url).pathname; // Repo-Wurzel (Server läuft aus dist-server/)
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const srv = spawn("node", ["dist-server/index.js"], { cwd: ROOT, env: { ...process.env, PORT: "3203", DATA_DIR: SP + "/data-shop2" }, stdio: "ignore" });
await wait(1500);
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH ?? "/opt/pw-browsers/chromium-1194/chrome-linux/chrome" });
async function run(answer) {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, locale: "de-DE" });
  await ctx.addInitScript(() => localStorage.setItem("billsplit.profile", JSON.stringify({ name: "Niklas", paypalMe: "niklasb", paypalEmail: "" })));
  const page = await ctx.newPage();
  page.on("pageerror", (e) => console.log("pageerror", e.message));
  await page.route("**/api/parse-receipt", (route) => route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({
    merchant: "REWE Markt", date: "2026-10-09", currency: "EUR",
    items: [{ name: "Vollmilch 1l", qty: 1, total: 120 }, { name: "Olivenöl", qty: 1, total: 699 }],
    total: 819, tip: null, fees: [], delivery: false, supermarket: true, engine: "ai" }) }));
  await page.goto("http://localhost:3203/");
  await page.locator(".action-card.primary input[type=file]").setInputFiles(`${SP}/shots/app-receipt.png`);
  await page.waitForSelector(".sheet h2", { timeout: 15000 }); await wait(400);
  if (answer === "Alles aufteilen") await page.locator(".sheet").screenshot({ path: `${SP}/shots/shop-ask.png` });
  console.log(answer, "| list before answer:", await page.locator(".shop-items").count());
  await page.getByRole("button", { name: answer }).click(); await wait(300);
  console.log(answer, "| list after answer:", await page.locator(".shop-items").count());
  await page.locator(".sheet").getByRole("button", { name: "QR-Code erstellen" }).click();
  await page.waitForURL(/#\/b\//, { timeout: 10000 }); await wait(1200);
  console.log(answer, "| write bar:", await page.locator(".write-bar").count(), "| equal:", await page.getByRole("switch", { name: /Gleichverteilung/ }).getAttribute("aria-checked"));
  await ctx.close();
}
await run("Alles aufteilen");
await run("Manches nicht");
await browser.close();
srv.kill();
