import { chromium } from "playwright-core";
import { spawn } from "node:child_process";
const SP = process.argv[2];
const ROOT = new URL("..", import.meta.url).pathname; // Repo-Wurzel (Server läuft aus dist-server/)
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const srv = spawn("node", ["dist-server/index.js"], { cwd: ROOT, env: { ...process.env, PORT: "3250", DATA_DIR: SP + "/data-transfer" }, stdio: "ignore" });
await wait(1500);
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH ?? "/opt/pw-browsers/chromium-1194/chrome-linux/chrome" });
// 1) Profile
const pc = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, locale: "de-DE" });
const pp = await pc.newPage();
await pp.goto("http://localhost:3250/#/profile?next=new");
await pp.getByPlaceholder("z. B. Niklas").fill("Niklas");
await pp.getByPlaceholder("DE00 0000 0000 0000 0000 00").fill("DE88 3704 0044 0532 0130 00");
await pp.getByRole("button", { name: "Weiter zur Kamera" }).click(); await wait(300);
console.log("invalid IBAN error:", await pp.locator(".error").allTextContents());
await pp.getByPlaceholder("DE00 0000 0000 0000 0000 00").fill("de89370400440532013000");
await pp.getByPlaceholder("+49 170 1234567").fill("+49 170 1234567");
await pp.locator("input").first().focus();
await pp.screenshot({ path: `${SP}/shots/profile-pay.png`, fullPage: true });
await pp.getByRole("button", { name: "Weiter zur Kamera" }).click(); await wait(500);
console.log("after save url:", pp.url().replace(/.*#/, "#"), "| stored:", await pp.evaluate(() => localStorage.getItem("billsplit.profile")));
// 2) Bill with bank + Wero only
const res = await fetch("http://localhost:3250/api/bills", { method: "POST", headers: { "content-type": "application/json", "x-billsplit-key": "ownerkey-1234567890abcdef" }, body: JSON.stringify({ name: "Niklas", data: { title: "Lidl", date: "2026-10-10", currency: "EUR", items: [{ id: "a", name: "Pizza", qty: 1, total: 1341 }], tipPercent: 0, payment: { iban: "DE89370400440532013000", holder: "Niklas Bocket", wero: "+49 170 1234567" } } }) });
const { id } = await res.json();
const gc = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, locale: "de-DE", permissions: ["clipboard-read", "clipboard-write"] });
await gc.addInitScript((id) => { localStorage.setItem("billsplit.profile", JSON.stringify({ name: "Ben", paypalMe: "", paypalEmail: "" })); localStorage.setItem(`billsplit.claimDemo.${id}`, "1"); }, id);
const g = await gc.newPage();
await g.goto(`http://localhost:3250/#/b/${id}`); await g.waitForSelector(".paybar");
await g.locator(".receipt .rline-main").first().click(); await wait(700);
await g.locator(".paybar .btn-paypal").click(); await wait(500);
console.log("sheet rows:", await g.locator(".transfer-sheet .copy-row").allInnerTexts());
await g.locator(".copy-row", { hasText: "IBAN" }).getByRole("button").click(); await wait(200);
console.log("clipboard:", await g.evaluate(() => navigator.clipboard.readText()), "| btn:", await g.locator(".copy-row", { hasText: "IBAN" }).getByRole("button").textContent());
await g.locator(".transfer-sheet").screenshot({ path: `${SP}/shots/transfer-bank.png` });
await g.getByRole("tab", { name: "Wero" }).click(); await wait(200);
await g.locator(".transfer-sheet").screenshot({ path: `${SP}/shots/transfer-wero.png` });
await g.getByRole("button", { name: "Fertig" }).click(); await wait(800);
console.log("paybar after:", await g.locator(".paybar").innerText());
// 3) PayPal + bank
const res2 = await fetch("http://localhost:3250/api/bills", { method: "POST", headers: { "content-type": "application/json", "x-billsplit-key": "ownerkey-1234567890abcdef" }, body: JSON.stringify({ name: "Niklas", data: { title: "Takumi", date: "2026-10-10", currency: "EUR", items: [{ id: "a", name: "Ramen", qty: 1, total: 1240 }], tipPercent: 0, payment: { paypalMe: "nik", iban: "DE89370400440532013000" } } }) });
const { id: id2 } = await res2.json();
await g.goto(`http://localhost:3250/#/b/${id2}`); await g.waitForSelector(".paybar"); await wait(500);
await g.locator(".receipt .rline-main").first().click(); await wait(700);
console.log("paypal+bank paybar:", await g.locator(".paybar").innerText());
await g.locator(".paybar").screenshot({ path: `${SP}/shots/paybar-other.png` });
await browser.close(); srv.kill();
