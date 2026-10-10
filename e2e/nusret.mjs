import { chromium } from "playwright-core";
import { spawn } from "node:child_process";
const SP = process.argv[2];
const ROOT = new URL("..", import.meta.url).pathname; // Repo-Wurzel (Server läuft aus dist-server/)
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const srv = spawn("node", ["dist-server/index.js"], { cwd: ROOT, env: { ...process.env, PORT: "3237", DATA_DIR: SP + "/data-nusret" }, stdio: "ignore" });
await wait(1500);
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH ?? "/opt/pw-browsers/chromium-1194/chrome-linux/chrome" });
for (const button of ["Rechnung erstellen", "Ohne Trinkgeld weiter"]) {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, locale: "de-DE" });
  await ctx.addInitScript(() => localStorage.setItem("billsplit.profile", JSON.stringify({ name: "Niklas", paypalMe: "niklasb", paypalEmail: "" })));
  const page = await ctx.newPage();
  await page.route("**/api/parse-receipt", (route) => route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({
    merchant: "Nusr-Et (Nusret Galleria Restaurant LTD)", date: "2022-11-17", currency: "AED",
    items: [
      { name: "Beef Carpaccio", qty: 5, total: 120000 }, { name: "Golden Ottoman", qty: 2, total: 550000 },
      { name: "Petrus 2009", qty: 4, total: 39600000 }, { name: "Romanee Conti 2009", qty: 1, total: 20000000 },
      { name: "Red Bull", qty: 4, total: 12000 },
    ],
    total: null, tip: null, fees: [{ name: "VAT 5%", amount: 3014100 }], delivery: false, supermarket: false, engine: "ai" }) }));
  await page.goto("http://localhost:3237/");
  await page.locator(".action-card.primary input[type=file]").setInputFiles(`${SP}/shots/app-receipt.png`);
  await page.waitForSelector(".sheet h2", { timeout: 15000 });
  await page.locator(".sheet").getByRole("button", { name: button }).click();
  await page.waitForURL(/#\/b\//, { timeout: 8000 }).catch(() => {});
  await wait(800);
  console.log(button, "→", page.url().replace(/.*#/, "#"), await page.locator(".alert").allTextContents(), await page.locator(".grand").last().textContent().catch(() => ""));
  await ctx.close();
}
await browser.close();
srv.kill();
