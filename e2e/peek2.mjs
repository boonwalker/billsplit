import { chromium } from "playwright-core";
import { spawn } from "node:child_process";
const SP = process.argv[2];
const ROOT = new URL("..", import.meta.url).pathname; // Repo-Wurzel (Server läuft aus dist-server/)
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const PORT = 3276;
const srv = spawn("node", ["dist-server/index.js"], { cwd: ROOT, env: { ...process.env, PORT: String(PORT), DATA_DIR: SP + "/data-peek2" }, stdio: "ignore" });
try {
await wait(1500);
const call = (path, key, method, body) => fetch(`http://localhost:${PORT}${path}`, { method, headers: { "content-type": "application/json", "x-billsplit-key": key }, body: body && JSON.stringify(body) }).then((r) => r.json());
const NIK = "nikkey-1234567890abcdefghij";
const id = (await call("/api/bills", NIK, "POST", { name: "Niklas", data: { title: "REWE Ridders OHG", date: "2026-10-10", currency: "EUR", items: [{ id: "a", name: "Spezi", qty: 1, total: 95 }, { id: "b", name: "Creme Brulee", qty: 1, total: 139 }], tipPercent: 0, payment: { paypalMe: "nik" } } })).id;
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH ?? "/opt/pw-browsers/chromium-1194/chrome-linux/chrome" });
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, locale: "de-DE", colorScheme: "dark" });
await ctx.addInitScript(([k]) => { localStorage.setItem("billsplit.deviceKey", JSON.stringify(k)); localStorage.setItem("billsplit.profile", JSON.stringify({ name: "Niklas", paypalMe: "nik", paypalEmail: "" })); }, [NIK]);
const p = await ctx.newPage();
await p.goto(`http://localhost:${PORT}/#/b/${id}`); await p.waitForSelector(".ownerbar"); await wait(2000);
console.log("peek on first open:", await p.locator(".receipt-peek").count());
let shot = 0;
for (let y = 0; y <= 900; y += 60) {
  await p.locator(".bill-scroll").evaluate((el, y) => el.scrollTo(0, y), y); await wait(120);
  const peekRect = await p.locator(".receipt-peek").boundingBox().catch(() => null);
  const paper = await p.locator("#receipt .receipt-paper").boundingBox();
  console.log(`scroll ${y}: peek ${peekRect ? Math.round(peekRect.y) + "/" + Math.round(peekRect.x) + "w" + Math.round(peekRect.width) : "—"} | paper top ${Math.round(paper.y)} x ${Math.round(paper.x)} w ${Math.round(paper.width)}`);
  if (peekRect && shot < 1 && paper.y - peekRect.y < 140) { shot++; await p.screenshot({ path: `${SP}/shots/peek-approach.png` }); }
  if (!peekRect) { await p.screenshot({ path: `${SP}/shots/peek-merged.png` }); break; }
}
await p.locator(".bill-scroll").evaluate((el) => el.scrollTo(0, 0)); await wait(800);
console.log("back at top, peek:", await p.locator(".receipt-peek").count());
await p.reload(); await p.waitForSelector(".ownerbar"); await wait(1800);
console.log("reopened, peek:", await p.locator(".receipt-peek").count());
await browser.close();
} finally { srv.kill(); }
