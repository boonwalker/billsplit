// The link preview picture (public/og.png, 1200×630) – WhatsApp, iMessage etc. show it next to shared links.
// node e2e/ogimage.mjs public/icon.svg public/og.png
import { chromium } from "playwright-core";
import { readFileSync } from "node:fs";
const [svgPath, out] = process.argv.slice(2);
const icon = readFileSync(svgPath, "utf8");
const font = (file) => readFileSync(new URL(`../node_modules/@fontsource/${file}`, import.meta.url)).toString("base64");
const html = `<html><head><style>
@font-face { font-family: G; font-weight: 700; src: url(data:font/woff2;base64,${font("space-grotesk/files/space-grotesk-latin-700-normal.woff2")}); }
@font-face { font-family: C; font-weight: 600; src: url(data:font/woff2;base64,${font("caveat/files/caveat-latin-600-normal.woff2")}); }
body { margin: 0; width: 1200px; height: 630px; background: #0d3b2a; color: #fffdf6; font-family: G; display: flex; align-items: center; overflow: hidden; }
.text { padding-left: 90px; flex: 1; }
.logo { display: flex; align-items: center; gap: 26px; }
.logo svg { width: 132px; height: 132px; }
.logo b { font-size: 92px; letter-spacing: -3px; }
h1 { margin: 46px 0 0; font-size: 70px; line-height: 1.05; letter-spacing: -2px; }
h1 span { color: #3ddc97; }
p { margin: 26px 0 0; font-size: 28px; white-space: nowrap; color: #cfe9dc; font-weight: 700; }
.receipt { width: 280px; margin-right: 80px; padding: 34px 30px 46px; background: #fffdf6; color: #0d3b2a; transform: rotate(4deg);
  clip-path: polygon(0 0, 100% 0, 100% 94%, 92% 100%, 84% 94%, 76% 100%, 68% 94%, 60% 100%, 52% 94%, 44% 100%, 36% 94%, 28% 100%, 20% 94%, 12% 100%, 4% 94%, 0 100%); }
.row { display: flex; align-items: center; gap: 14px; font-size: 27px; margin: 18px 0; }
.row i { width: 30px; height: 30px; border-radius: 50%; border: 3px solid #0d3b2a; flex: none; }
.row.on i { background: #3ddc97; }
.row s { opacity: 0.5; }
.row em { margin-left: auto; font-style: normal; }
.who { font-family: C; font-size: 30px; color: #1a7f55; margin: -14px 0 0 44px; }
</style></head><body>
<div class="text">
  <div class="logo">${icon.replace("<svg", '<svg aria-hidden="true"')}<b>klicksplit</b></div>
  <h1>Einer zahlt.<br><span>Alle splitten.</span></h1>
  <p>Beleg fotografieren · abhaken · zahlen</p>
</div>
<div class="receipt">
  <div class="row on"><i></i>Pizza<em>9,50</em></div><div class="who">Anna</div>
  <div class="row on"><i></i>Pasta<em>11,80</em></div><div class="who">Du</div>
  <div class="row"><i></i>Wein<em>6,00</em></div>
  <div class="row"><i></i>Tiramisu<em>5,50</em></div>
</div>
</body></html>`;
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH ?? "/opt/pw-browsers/chromium-1194/chrome-linux/chrome" });
const page = await browser.newPage({ viewport: { width: 1200, height: 630 }, deviceScaleFactor: 1 });
await page.setContent(html);
await page.evaluate(() => document.fonts.ready);
await page.screenshot({ path: out });
await browser.close();
