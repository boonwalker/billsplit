import { chromium } from "playwright-core";
import { spawn } from "node:child_process";
const SP = process.argv[2];
const ROOT = new URL("..", import.meta.url).pathname; // Repo-Wurzel (Server läuft aus dist-server/)
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const srv = spawn("node", ["dist-server/index.js"], { cwd: ROOT, env: { ...process.env, PORT: "3260", DATA_DIR: SP + "/data-loop" }, stdio: "ignore" });
await wait(1500);
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH ?? "/opt/pw-browsers/chromium-1194/chrome-linux/chrome" });
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, locale: "de-DE", hasTouch: true });
await ctx.addInitScript(() => localStorage.setItem("billsplit.profile", JSON.stringify({ name: "Niklas", paypalMe: "nik", paypalEmail: "" })));
const page = await ctx.newPage();
await page.route("**/api/parse-receipt", (route) => route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ merchant: "REWE City", date: "2017-06-23", currency: "EUR", items: [{ name: "Spruehsahne 30%", qty: 2, total: 198 }, { name: "Vanille", qty: 1, total: 199 }, { name: "Milchschokostr", qty: 1, total: 99 }, { name: "Trinkhalme", qty: 1, total: 149 }], total: 655, tip: null, fees: [{ name: "KL.PAPIERTASCHE", amount: 10 }], delivery: false, supermarket: true, engine: "ai" }) }));
await page.goto("http://localhost:3260/");
await page.locator(".action-card.primary input[type=file]").setInputFiles(`${SP}/shots/app-receipt.png`);
await page.waitForSelector(".sheet h2", { timeout: 15000 });
const probe = async () => {
  const strike = await page.locator(".rdemo .rdemo-strike:not(.after-tap)").count();
  const tap = await page.locator(".rdemo .rdemo-tap").count();
  const hold = await page.locator(".hold-demo").count();
  const bubble = await page.locator(".hold-demo-bubble").count();
  return `${strike ? "strike " : ""}${tap ? "tap " : ""}${hold ? "press " : ""}${bubble ? "held" : ""}` || "-";
};
const sample = async (label, ms, shots = {}) => {
  const t0 = Date.now(); const seen = [];
  while (Date.now() - t0 < ms) {
    const t = Math.round((Date.now() - t0) / 100) / 10;
    seen.push(`${t}:${await probe()}`);
    for (const [at, name] of Object.entries(shots)) if (t >= +at && !shots[`done${at}`]) { shots[`done${at}`] = 1; await page.screenshot({ path: `${SP}/shots/${name}.png`, clip: { x: 0, y: 260, width: 390, height: 360 } }); }
    await wait(250);
  }
  console.log(label, seen.filter((x, i, a) => i === 0 || x.split(":")[1] !== a[i - 1].split(":")[1]).join("  "));
};
await page.getByRole("button", { name: "Manches nicht" }).click();
await sample("scribble", 1000);
console.log("lines:", (await page.locator(".scribble li[data-item]").evaluateAll((ls) => ls.map((l) => l.dataset.qty + " " + l.innerText.split("\n")[0]))).join(" | "));
// back, alles aufteilen
await page.locator(".scribble-back").click(); await wait(500);
await page.getByRole("button", { name: "Alles aufteilen" }).click(); await wait(300);
await page.locator(".sheet").getByRole("button", { name: "Rechnung erstellen" }).click();
await page.waitForSelector(".receipt .rline", { timeout: 10000 });
await page.locator(".receipt .rline").last().scrollIntoViewIfNeeded(); 
await wait(9500); await page.locator(".receipt-lines-wrap").screenshot({ path: `${SP}/shots/bill-held.png` });
const line = page.locator(".receipt li[data-item]").filter({ hasText: "Trinkhalme" });
const b = await line.boundingBox();
await page.mouse.move(b.x + 40, b.y + b.height / 2); await page.mouse.down();
for (let i = 1; i <= 8; i++) { await page.mouse.move(b.x + 40 + i * 25, b.y + b.height / 2 + 2); await wait(20); }
await page.mouse.up(); await wait(800);
console.log("after swipe:", await line.getAttribute("class"), "| demo left:", await probe());
await browser.close(); srv.kill();
