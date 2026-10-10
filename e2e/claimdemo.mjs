import { chromium } from "playwright-core";
import { spawn } from "node:child_process";
const SP = process.argv[2];
const ROOT = new URL("..", import.meta.url).pathname; // Repo-Wurzel (Server läuft aus dist-server/)
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const srv = spawn("node", ["dist-server/index.js"], { cwd: ROOT, env: { ...process.env, PORT: "3239", DATA_DIR: SP + "/data-claimdemo" }, stdio: "ignore" });
await wait(1500);
const res = await fetch("http://localhost:3239/api/bills", { method: "POST", headers: { "content-type": "application/json", "x-billsplit-key": "ownerkey-1234567890abcdef" }, body: JSON.stringify({ name: "Niklas", data: { title: "Takumi", date: "2026-10-10", currency: "EUR", items: [{ id: "a", name: "Takoyaki (4 Stk.)", qty: 1, total: 650 }, { id: "b", name: "Ramen Shoyu", qty: 2, total: 2480 }, { id: "c", name: "Edamame", qty: 1, total: 490 }, { id: "d", name: "Asahi 0,33l", qty: 3, total: 1350 }], tipPercent: 0, payment: { paypalMe: "nik" } } }) });
const { id } = await res.json();
await fetch(`http://localhost:3239/api/bills/${id}/join`, { method: "POST", headers: { "content-type": "application/json", "x-billsplit-key": "annakey-1234567890abcdef" }, body: JSON.stringify({ name: "Anna" }) });
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH ?? "/opt/pw-browsers/chromium-1194/chrome-linux/chrome" });
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, locale: "de-DE" });
await ctx.addInitScript(() => localStorage.setItem("billsplit.profile", JSON.stringify({ name: "Ben", paypalMe: "", paypalEmail: "" })));
const p = await ctx.newPage();
await p.goto(`http://localhost:3239/#/b/${id}`);
await p.waitForSelector(".receipt .rline");
const t0 = Date.now();
await p.locator(".receipt-lines-wrap").scrollIntoViewIfNeeded();
const shots = [1700, 3300, 5100, 6900, 8600, 10500];
for (const t of shots) { await wait(t - (Date.now() - t0)); await p.locator(".receipt-lines-wrap").screenshot({ path: `${SP}/shots/cd-${t}.png` }); }
console.log("claims of Ben (should be none):", (await (await fetch(`http://localhost:3239/api/bills/${id}`)).json()).participants.map((x) => [x.name, JSON.stringify(x.claims)]));
await p.reload(); await p.waitForSelector(".receipt .rline"); await wait(2500);
console.log("demo after reload:", await p.locator(".claim-demo").count());
await browser.close();
srv.kill();
