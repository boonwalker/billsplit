import { chromium } from "playwright-core";
import { readFileSync } from "node:fs";
const [svgPath, outDir] = process.argv.slice(2);
const src = readFileSync(svgPath, "utf8");
const inner = src.replace(/^[\s\S]*?<svg[^>]*>/, "").replace(/<\/svg>\s*$/, "").replace(/<rect[^>]*\/>/, "");
// full: square background without rounded corners (iOS / maskable round it themselves)
// scale: glyph scale around the center (maskable icons need a safe zone)
const svg = ({ rounded, scale = 1 }) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48" width="100%" height="100%">
  <rect width="48" height="48" ${rounded ? 'rx="13"' : ""} fill="#0d3b2a"/>
  <g transform="translate(24 24) scale(${scale}) translate(-24 -24)">${inner}</g></svg>`;
const jobs = [
  ["apple-touch-icon.png", 180, { rounded: false }],
  ["icon-192.png", 192, { rounded: true }],
  ["icon-512.png", 512, { rounded: true }],
  ["icon-maskable-512.png", 512, { rounded: false, scale: 0.8 }],
];
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH ?? "/opt/pw-browsers/chromium-1194/chrome-linux/chrome" });
for (const [name, size, opts] of jobs) {
  const page = await browser.newPage({ viewport: { width: size, height: size }, deviceScaleFactor: 1 });
  await page.setContent(`<html><body style="margin:0;background:transparent">${svg(opts)}</body></html>`);
  await page.screenshot({ path: `${outDir}/${name}`, omitBackground: true });
  await page.close();
}
await browser.close();
