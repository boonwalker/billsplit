import { chromium } from "playwright-core";
import { spawn } from "node:child_process";
const SP = process.argv[2];
const ROOT = new URL("..", import.meta.url).pathname; // Repo-Wurzel (Server läuft aus dist-server/)
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const srv = spawn("node", ["dist-server/index.js"], { cwd: ROOT, env: { ...process.env, PORT: "3266", DATA_DIR: SP + "/data-hold3" }, stdio: "ignore" });
await wait(1500);
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH ?? "/opt/pw-browsers/chromium-1194/chrome-linux/chrome" });
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, locale: "de-DE", hasTouch: true });
await ctx.addInitScript(() => localStorage.setItem("billsplit.profile", JSON.stringify({ name: "Niklas", paypalMe: "nik", paypalEmail: "" })));
const page = await ctx.newPage();
await page.route("**/api/parse-receipt", (route) => route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ merchant: "REWE City", date: "2017-06-23", currency: "EUR", items: [{ name: "Spruehsahne 30%", qty: 2, total: 198 }, { name: "Vanille", qty: 1, total: 199 }, { name: "Milchschokostr", qty: 1, total: 99 }, { name: "Trinkhalme", qty: 1, total: 149 }], total: 655, tip: null, fees: [{ name: "KL.PAPIERTASCHE", amount: 10 }], delivery: false, supermarket: true, engine: "ai" }) }));
await page.goto("http://localhost:3266/");
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
await wait(7800);
console.log("holding line:", await page.locator(".scribble li.demo-holding").innerText().catch(() => "none"));
await browser.close(); srv.kill();
