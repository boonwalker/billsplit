import { chromium } from "playwright-core";
const SP = process.argv[2];
const files = ["01-home.png", "07-anna-bill.png", "09-anna-paid.png"];
const b = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH ?? "/opt/pw-browsers/chromium-1194/chrome-linux/chrome" });
const p = await b.newPage({ viewport: { width: 1200, height: 860 } });
await p.setContent(`<body style="margin:0;display:flex;gap:12px;background:#888;padding:6px">${files.map(f=>`<img src="file://${SP}/shots/${f}" style="width:390px">`).join("")}</body>`);
await p.waitForTimeout(300);
await p.screenshot({ path: `${SP}/shots/combo.png` });
await b.close();
