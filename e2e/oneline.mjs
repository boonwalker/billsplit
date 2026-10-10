import { chromium } from "playwright-core";
import { spawn } from "node:child_process";
const SP = process.argv[2];
const ROOT = new URL("..", import.meta.url).pathname; // Repo-Wurzel (Server läuft aus dist-server/)
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const srv = spawn("node", ["dist-server/index.js"], { cwd: ROOT, env: { ...process.env, PORT: "3264", DATA_DIR: SP + "/data-oneline" }, stdio: "ignore" });
await wait(1500);
const call = (path, key, method, body) => fetch(`http://localhost:3264${path}`, { method, headers: { "content-type": "application/json", "x-billsplit-key": key }, body: body && JSON.stringify(body) }).then((r) => r.json());
const OK = "ownerkey-1234567890abcdef";
const { id } = await call("/api/bills", OK, "POST", { name: "Niklas", data: { title: "A", date: "2026-10-10", currency: "EUR", items: [{ id: "t", name: "Tenderloin", qty: 1, total: 7990 }, { id: "s", name: "House Salad", qty: 1, total: 590 }, { id: "b", name: "Knoblauch-Kräuterbutter", qty: 1, total: 390 }, { id: "c", name: "Coca Cola", qty: 2, total: 920 }], tipPercent: 15, payment: { paypalMe: "nik" } } });
await call(`/api/bills/${id}/claims`, OK, "PUT", { claims: { t: [0] } });
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH ?? "/opt/pw-browsers/chromium-1194/chrome-linux/chrome" });
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, locale: "de-DE", hasTouch: true, userAgent: "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1" });
const p = await ctx.newPage();
const reqs = [];
p.on("response", async (r) => { if (r.url().includes("/claims")) reqs.push(r.status() + " " + (await r.text()).slice(0, 120)); });
p.on("console", (m) => m.type() === "error" && console.log("console:", m.text()));
await p.goto(`http://localhost:3264/#/b/${id}?to=nik`); await wait(1000);
await p.locator(".sheet input").fill("Ben"); await p.getByRole("button", { name: "Zur Rechnung" }).click(); await wait(1500);
await p.locator('.rline:has-text("Coca Cola") .rline-main').tap(); await wait(1200);
const measure = async (label) => {
  await p.locator(".bill-scroll").evaluate((el) => el.scrollTo(0, el.scrollHeight)); await wait(500);
  const r = await p.locator(".receipt").boundingBox(); const bar = await p.locator(".paybar").boundingBox();
  const orig = await p.locator(".receipt-original").boundingBox().catch(() => null);
  console.log(label, "receipt bottom", Math.round(r.y + r.height), "| bar top", Math.round(bar.y), "| bar h", Math.round(bar.height), "| original link bottom", orig && Math.round(orig.y + orig.height));
};
await p.getByRole("button", { name: /Anteil begleichen/ }).click(); await wait(400);
for (const w of [390, 375, 430]) {
  await p.setViewportSize({ width: w, height: 844 }); await wait(400);
  console.log(w, await p.locator(".paybar-oneline").evaluate((el) => `${getComputedStyle(el).fontSize} fits=${el.scrollWidth <= el.clientWidth}`), "| parent", await p.locator(".paybar-copied").evaluate((el) => getComputedStyle(el).fontSize));
}
await p.setViewportSize({ width: 390, height: 844 }); await wait(400);
await p.locator(".paybar").screenshot({ path: `${SP}/shots/oneline.png` });
await browser.close(); srv.kill();
