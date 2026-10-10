import { chromium } from "playwright-core";
import { spawn } from "node:child_process";
const SP = process.argv[2];
const ROOT = new URL("..", import.meta.url).pathname; // Repo-Wurzel (Server läuft aus dist-server/)
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const srv = spawn("node", ["dist-server/index.js"], { cwd: ROOT, env: { ...process.env, PORT: "3236", DATA_DIR: SP + "/data-handoff" }, stdio: "ignore" });
await wait(1500);
const res = await fetch("http://localhost:3236/api/bills", { method: "POST", headers: { "content-type": "application/json", "x-billsplit-key": "ownerkey-1234567890abcdef" }, body: JSON.stringify({ name: "Niklas", data: { title: "Lidl", date: "2026-10-10", currency: "EUR", items: [{ id: "a", name: "Pizza", qty: 1, total: 1000 }], tipPercent: 0, payment: { paypalMe: "nik" } } }) });
const { id } = await res.json();
const UA = "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1";
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH ?? "/opt/pw-browsers/chromium-1194/chrome-linux/chrome" });

// 1) App opened without any hand-over: no prompt.
const app = await browser.newContext({ userAgent: UA, viewport: { width: 390, height: 844 }, locale: "de-DE" });
await app.addInitScript(() => {
  Object.defineProperty(navigator, "standalone", { value: true });
  localStorage.setItem("billsplit.profile", JSON.stringify({ name: "Ben", paypalMe: "", paypalEmail: "" }));
  Object.defineProperty(navigator, "clipboard", { value: { readText: async () => window.__clip ?? "", writeText: async () => {} } });
});
const ap = await app.newPage();
await ap.goto("http://localhost:3236/"); await wait(800);
console.log("app, no handoff → prompt:", await ap.locator(".handoff").count());

// 2) Safari: the bill asks first and offers the app.
const safari = await browser.newContext({ userAgent: UA, viewport: { width: 390, height: 844 }, locale: "de-DE", permissions: ["clipboard-read", "clipboard-write"] });
await safari.addInitScript(() => localStorage.setItem("billsplit.profile", JSON.stringify({ name: "Ben", paypalMe: "", paypalEmail: "" })));
const sp = await safari.newPage();
const link = `http://localhost:3236/#/b/${id}?to=nik`;
await sp.goto(link); await wait(1000);
console.log("safari name prompt:", await sp.locator(".sheet h2").textContent(), "| prefilled:", await sp.locator(".sheet input").inputValue(), "| participants joined:", (await (await fetch(`http://localhost:3236/api/bills/${id}`)).json()).participants.length);
await sp.locator(".sheet").screenshot({ path: `${SP}/shots/handoff-safari.png` });
await sp.locator(".sheet .open-in-app button").click(); await wait(300);
console.log("safari after tap:", await sp.locator(".sheet .open-in-app").textContent());
console.log("clipboard:", await sp.evaluate(() => navigator.clipboard.readText()));

// 3) App comes to the foreground: prompt appears, opens the copied link.
await ap.evaluate((l) => (window.__clip = l), link);
await ap.evaluate(() => document.dispatchEvent(new Event("visibilitychange"))); await wait(600);
console.log("app after handoff → prompt:", await ap.locator(".handoff").count());
await ap.screenshot({ path: `${SP}/shots/handoff-app.png` });
await ap.getByRole("button", { name: "Kopierten Link öffnen" }).click(); await wait(1200);
console.log("app url:", ap.url(), "| paybar:", await ap.locator(".paybar").count(), "| prompt:", await ap.locator(".handoff").count());
console.log("still pending:", (await (await fetch("http://localhost:3236/api/handoff")).json()).pending);
await browser.close();
srv.kill();
