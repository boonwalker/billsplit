/**
 * Mails of the optional account: the sign-in code and, once an account is created, a welcome.
 * With RESEND_API_KEY and MAIL_FROM (e.g. "klicksplit <code@klicksplit.de>") they go out through
 * Resend; without them they are only written to the log, so everything can be tried before the
 * mail service is set up (and, for the click tests, to the file MAIL_OUTBOX).
 */

import { appendFile } from "node:fs/promises";

/** name: the person's profile name for the greeting, when known. */
export type SendCode = (email: string, code: string, name?: string) => Promise<void>;
export type SendWelcome = (email: string, name?: string) => Promise<void>;

export interface Mail {
  subject: string;
  text: string;
  html: string;
}

/** The sender's display name ("klicksplit" in "klicksplit <code@klicksplit.de>"), used in the text too. */
export function senderName(from: string | undefined): string {
  const name = from?.match(/^\s*"?([^"<]+?)"?\s*</)?.[1]?.trim();
  return name || "klicksplit";
}

/** Colours and type of the app (src/styles/01-tokens.css), written out: mail clients know no CSS variables. */
const C = {
  bg: "#eef1ec",
  paper: "#fffdf6",
  ink: "#1b1f1c",
  inkSoft: "#5b625d",
  inkFaint: "#c9c6ba",
  brand: "#0d3b2a",
  claim: "#0f7a4d",
  mint: "#3ddc97",
  mintSoft: "#d9f7e8",
  muted: "#5d6963",
};
const DISPLAY = "'Space Grotesk', -apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif";
const MONO = "'JetBrains Mono', 'SF Mono', Menlo, Consolas, monospace";
const TOOTH = 9;

const escapeHtml = (text: string) => text.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!);

/** "klicksplit" → klick + bold green split, like the app's wordmark. */
function wordmark(name: string, size: number, light: string, green: string): string {
  const m = name.match(/^(.*?)(split)$/i);
  const [first, second] = m && m[1] ? [m[1], m[2]] : [name, ""];
  return `<span style="font-family:${DISPLAY};font-size:${size}px;font-weight:500;letter-spacing:-0.02em;color:${light}">${escapeHtml(first)}<b style="font-weight:700;color:${green}">${escapeHtml(second)}</b></span>`;
}

/** "Hi Niklas," – or just "Hi," without a name. */
export function greeting(name?: string): string {
  const clean = name?.trim().slice(0, 40);
  return clean ? `Hi ${clean},` : "Hi,";
}

/** The torn paper edge of the receipt: teeth pointing up (top) or down (bottom). */
function edge(side: "top" | "bottom"): string {
  const from = side === "top" ? "135deg at top" : "-45deg at bottom";
  return `<tr><td class="ks-edge" style="height:${TOOTH}px;line-height:${TOOTH}px;font-size:0;background:conic-gradient(from ${from}, transparent, ${C.paper} 1deg 89deg, transparent 90deg) ${side} / ${TOOTH * 2}px ${TOOTH}px repeat-x">&nbsp;</td></tr>`;
}

/**
 * The frame of every mail, in the app's look: logo and wordmark, then the content on a receipt
 * with torn edges that slides out like from a printer (where the mail program allows
 * animation). Everything stands on the receipt, down to the app's line "Einer zahlt. Alle
 * splitten." at its end. Built the way mail clients need it: tables, inline styles, fallback
 * fonts and plain edges where gradients fail.
 */
function layout({
  title,
  preheader,
  name,
  logoUrl,
  receipt,
  footnote,
  style = "",
}: {
  title: string;
  preheader: string;
  name: string;
  logoUrl?: string;
  receipt: string;
  footnote?: string;
  /** Extra CSS for the content (e.g. the demo receipt's animations). */
  style?: string;
}): string {
  const logo = logoUrl
    ? `<td style="padding-right:10px;vertical-align:middle"><img src="${escapeHtml(logoUrl)}" width="40" height="40" alt="" style="display:block;border:0;border-radius:11px"></td>`
    : "";
  return `<!doctype html>
<html lang="de">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="color-scheme" content="light">
<meta name="supported-color-schemes" content="light">
<title>${escapeHtml(title)}</title>
<link href="https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@500;700&amp;family=JetBrains+Mono:wght@400;700&amp;family=Caveat:wght@600&amp;display=swap" rel="stylesheet">
<style>
@keyframes ks-print { from { transform: translateY(-24px); clip-path: inset(0 0 100% 0); } to { transform: none; clip-path: inset(0 0 0 0); } }
@media (prefers-reduced-motion: no-preference) { .ks-receipt { animation: ks-print 1.1s cubic-bezier(0.3, 0.7, 0.2, 1) both; } }
${style}</style>
</head>
<body style="margin:0;padding:0;background:${C.bg}">
<div style="display:none;max-height:0;overflow:hidden;opacity:0">${escapeHtml(preheader)}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:${C.bg}">
<tr><td align="center" style="padding:32px 16px">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:480px">
    <tr><td style="padding:0 4px 22px">
      <table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr>${logo}<td style="vertical-align:middle">${wordmark(name, 24, C.ink, C.claim)}</td></tr></table>
    </td></tr>
    <tr><td>
      <div class="ks-receipt">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
        ${edge("top")}
        <tr><td style="background:${C.paper};padding:22px 22px 26px;font-family:${MONO};font-size:14px;line-height:1.55;color:${C.ink}">
${receipt}
          ${footnote ? `<div style="margin-top:18px;font-size:12px;line-height:1.55;color:${C.muted}">${escapeHtml(footnote)}</div>` : ""}
          <br><br><br>
          <div style="font-family:${DISPLAY};font-size:15px;line-height:1.4">${wordmark(name, 15, C.ink, C.claim)} <span style="color:${C.muted}">&bull;</span></div>
          <div style="padding-top:8px;font-family:${DISPLAY};font-size:32px;font-weight:700;letter-spacing:-0.035em;line-height:1.08;color:${C.ink}">Einer zahlt.</div>
          <div style="font-family:${DISPLAY};font-size:32px;font-weight:700;letter-spacing:-0.035em;line-height:1.08;color:${C.mint}">Alle splitten.</div>
        </td></tr>
        ${edge("bottom")}
      </table>
      </div>
    </td></tr>
  </table>
</td></tr>
</table>
</body>
</html>`;
}

/** The receipt's head: a green star, a title in capitals, the date. */
function receiptHead(title: string, now: Date): string {
  const date = now.toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit", year: "numeric", timeZone: "Europe/Berlin" });
  return `          <div style="text-align:center;color:${C.claim};font-size:18px">&#10022;</div>
          <div style="text-align:center;font-weight:700;font-size:17px;letter-spacing:0.08em;text-transform:uppercase;padding-top:4px">${escapeHtml(title)}</div>
          <div style="text-align:center;font-size:12px;color:${C.inkSoft}">${date}</div>
          <div style="border-top:2px dashed ${C.inkFaint};margin:16px 0 16px;height:0;line-height:0;font-size:0">&nbsp;</div>`;
}

const rule = `<div style="border-top:2px dashed ${C.inkFaint};margin:18px 0 16px;height:0;line-height:0;font-size:0">&nbsp;</div>`;

/** The sign-in mail: the code large in a mint box on the receipt. */
export function codeMail(code: string, from: string | undefined, logoUrl?: string, person?: string, now = new Date()): Mail {
  const name = senderName(from);
  const hi = greeting(person);
  const receipt = `${receiptHead("Dein Code", now)}
          <p style="margin:0 0 4px">${escapeHtml(hi)}</p>
          <p style="margin:0 0 18px">hier ist Dein Code für ${escapeHtml(name)}:</p>
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr>
            <td align="center" style="background:${C.mintSoft};border-radius:14px;padding:18px 12px">
              <!-- One unbroken number (spaced by letter-spacing only): the iPhone offers codes from mails for filling in. -->
              <span style="font-family:${MONO};font-size:34px;font-weight:700;letter-spacing:10px;padding-left:10px;color:${C.brand}">${code}</span>
            </td>
          </tr></table>
          ${rule}
          <p style="margin:0;font-size:13px;color:${C.inkSoft}">Tippe ihn in ${escapeHtml(name)} ein – dort, wo Du ihn angefordert hast. Er gilt <b style="color:${C.ink}">15 Minuten</b>.</p>`;
  return {
    subject: `Dein ${name}-Code: ${code}`,
    text: `${hi}\n\nhier ist Dein Code für ${name}: ${code}\n\nTippe ihn in ${name} ein – dort, wo Du ihn angefordert hast. Er gilt 15 Minuten.\n\nWenn Du keinen Code angefordert hast, kannst Du diese Mail einfach ignorieren.\n\n\n\n${name} •\nEiner zahlt.\nAlle splitten.\n`,
    html: layout({
      title: `Dein ${name}-Code`,
      preheader: `Dein Code: ${code} – gilt 15 Minuten.`,
      name,
      logoUrl,
      receipt,
      footnote: "Wenn Du keinen Code angefordert hast, kannst Du diese Mail einfach ignorieren.",
    }),
  };
}

/** A shopping receipt for the welcome mail's demo: Duschgel gets crossed out, Olivenöl halved. */
const DEMO_ITEMS = [
  { name: "Spaghetti", total: 149 },
  { name: "Duschgel", total: 295 },
  { name: "Olivenöl", total: 790 },
  { name: "Parmesan", total: 379 },
];
const STRUCK = 1;
const HALVED = 2;
const PENCIL = "#3f413f";
const HAND = "'Caveat', 'Bradley Hand', 'Segoe Print', cursive";
const euro = (cents: number) => `${(cents / 100).toFixed(2).replace(".", ",")} €`;
const price = (cents: number) => (cents / 100).toFixed(2).replace(".", ",");

/**
 * The app's receipt in the welcome mail, built in three layers so every mail program shows
 * something sensible: a plain receipt (everywhere), the app's explainer as a loop – a tap
 * crosses out "Duschgel", holding halves "Olivenöl" to "/2" – where the program runs CSS
 * animations (Apple Mail), and lines that can be tapped to cross them out, with the total
 * following along, where it supports checkboxes (Apple Mail; the rest leaves them out). A
 * pre-checked probe box shows the "tap here" hint only where tapping works, and the first tap
 * stops the loop – like in the app.
 */
function demoReceipt(): { html: string; style: string } {
  const total = DEMO_ITEMS.reduce((sum, item) => sum + item.total, 0);
  const afterStrike = total - DEMO_ITEMS[STRUCK].total;
  const afterHalf = afterStrike - DEMO_ITEMS[HALVED].total / 2;
  const masks = Array.from({ length: 2 ** DEMO_ITEMS.length }, (_, mask) => mask).slice(1);
  const billed = (mask: number) => DEMO_ITEMS.reduce((sum, item, i) => sum + (mask & (1 << i) ? 0 : item.total), 0);
  const line = `linear-gradient(${PENCIL}, ${PENCIL}) no-repeat 0 58% / 0% 2.5px`;
  const hidden = "display:none;mso-hide:all";

  const rows = DEMO_ITEMS.map((item, i) => {
    const ring = i === STRUCK ? "ks-tap" : i === HALVED ? "ks-hold" : "";
    const amount =
      i === HALVED
        ? `<span style="position:relative;display:inline-block"><span class="ks-a ks-full">${price(item.total)}</span><span class="ks-a ks-half" style="${hidden};position:absolute;right:0;bottom:0;text-align:right;white-space:nowrap;line-height:1.2"><span style="font-size:11px;font-weight:400;color:${C.inkSoft};text-decoration:line-through">${price(item.total)}</span><br>${price(item.total / 2)}</span></span>`
        : price(item.total);
    const strike = i === STRUCK ? " ks-a ks-a-strike" : "";
    return `<label for="ks-i${i}" class="ks-row ks-r${i}" style="display:block;padding:7px 2px;cursor:pointer">
            <span style="display:table;width:100%"><span style="display:table-cell;vertical-align:bottom"><span style="position:relative;display:inline-block"><span class="ks-t${strike}" style="background:${line}">${escapeHtml(item.name)}</span>${
              // The finger taps (and holds) right on the word, as in the app's explainer.
              ring ? `<span class="ks-a ${ring}" style="${hidden};position:absolute;left:50%;top:50%;width:34px;height:34px;margin:-17px 0 0 -17px;border-radius:50%;border:2.5px solid ${C.mint};background:rgba(61,220,151,0.18);box-sizing:border-box"></span>` : ""
            }</span>${
              i === HALVED ? `<span class="ks-a ks-div" style="${hidden};margin-left:8px;font-family:${HAND};font-size:22px;line-height:1;color:${PENCIL}">/2</span>` : ""
            }</span><span style="display:table-cell;vertical-align:bottom;text-align:right;white-space:nowrap;font-weight:700"><span class="ks-t${strike}" style="background:${line}">${amount}</span></span></span>
          </label>`;
  }).join("\n          ");

  const sums = [
    `<span class="ks-a ks-sum0">${euro(total)}</span>`,
    `<span class="ks-a ks-sumA" style="${hidden};position:absolute;right:0;top:0">${euro(afterStrike)}</span>`,
    `<span class="ks-a ks-sumB" style="${hidden};position:absolute;right:0;top:0">${euro(afterHalf)}</span>`,
    ...masks.map((mask) => `<span class="ks-m${mask}" style="${hidden};position:absolute;right:0;top:0">${euro(billed(mask))}</span>`),
  ].join("");

  const html = `<input type="checkbox" class="ks-probe" checked style="${hidden}">
          ${DEMO_ITEMS.map((_, i) => `<input type="checkbox" id="ks-i${i}" class="ks-cb ks-c${i}" style="${hidden}">`).join("\n          ")}
          <div class="ks-demo">
          ${rows}
          <div style="border-top:2px dashed ${C.inkFaint};margin:8px 0 0;height:0;line-height:0;font-size:0">&nbsp;</div>
          <div style="display:table;width:100%;padding-top:8px;font-weight:700"><span style="display:table-cell;padding-left:2px">Abgerechnet werden</span><span style="display:table-cell;text-align:right;white-space:nowrap;padding-right:2px"><span style="position:relative;display:inline-block">${sums}</span></span></div>
          <p style="margin:14px 0 0;font-size:12px;line-height:1.5;color:${C.inkSoft}">Antippen = durchstreichen · Gedrückt halten = nur einen Teil in Rechnung stellen</p>
          <p class="ks-hint" style="${hidden};margin:6px 0 0;font-size:12px;font-weight:700;color:${C.claim}">↑ Probier's aus: Tipp hier in der Mail eine Zeile an.</p>
          </div>`;

  const checked = (i: number, on: boolean) => `.ks-c${i}${on ? ":checked" : ":not(:checked)"}`;
  const style = `
.ks-row { -webkit-tap-highlight-color: transparent; -webkit-user-select: none; user-select: none; }
.ks-row .ks-t { transition: background-size 0.6s ease, color 0.4s ease; }
.ks-row:active { transform: scale(0.985); }
.ks-probe:checked ~ .ks-demo .ks-hint { display: block !important; }
${DEMO_ITEMS.map((_, i) => `.ks-c${i}:checked ~ .ks-demo .ks-r${i} .ks-t { background-size: 100% 2.5px !important; color: #8d918e !important; }`).join("\n")}
.ks-cb:checked ~ .ks-demo .ks-sum0 { opacity: 0 !important; }
${masks.map((mask) => `${DEMO_ITEMS.map((_, i) => checked(i, Boolean(mask & (1 << i)))).join(" ~ ")} ~ .ks-demo .ks-m${mask} { display: inline !important; }`).join("\n")}
@media (prefers-reduced-motion: no-preference) {
  .ks-tap, .ks-hold, .ks-div, .ks-half, .ks-sumA, .ks-sumB { display: inline-block !important; opacity: 0; }
  .ks-tap, .ks-hold { display: block !important; }
  .ks-tap { animation: ks-tap 9s ease-out 1.6s infinite; }
  .ks-hold { animation: ks-hold 9s ease-in-out 1.6s infinite; }
  .ks-a-strike { animation: ks-strike 9s ease 1.6s infinite; }
  .ks-div, .ks-half { animation: ks-half 9s ease 1.6s infinite; }
  .ks-full { animation: ks-full 9s ease 1.6s infinite; }
  .ks-sum0 { animation: ks-sum0 9s ease 1.6s infinite; }
  .ks-sumA { animation: ks-sumA 9s ease 1.6s infinite; }
  .ks-sumB { animation: ks-sumB 9s ease 1.6s infinite; }
  /* The first tap ends the explainer, as in the app. */
  .ks-cb:checked ~ .ks-demo .ks-a { animation: none !important; }
}
@keyframes ks-tap { 0%, 10% { opacity: 0; transform: scale(0.4); } 13% { opacity: 1; transform: scale(1); } 19%, 100% { opacity: 0; transform: scale(1.6); } }
@keyframes ks-strike { 0%, 16% { background-size: 0% 2.5px; color: ${C.ink}; } 24%, 86% { background-size: 100% 2.5px; color: #8d918e; } 93%, 100% { background-size: 0% 2.5px; color: ${C.ink}; } }
@keyframes ks-hold { 0%, 32% { opacity: 0; transform: scale(0.5); } 35% { opacity: 1; transform: scale(0.7); } 49% { opacity: 1; transform: scale(1.25); } 53%, 100% { opacity: 0; transform: scale(1.4); } }
@keyframes ks-half { 0%, 49% { opacity: 0; } 53%, 86% { opacity: 1; } 92%, 100% { opacity: 0; } }
@keyframes ks-full { 0%, 49% { opacity: 1; } 53%, 86% { opacity: 0; } 92%, 100% { opacity: 1; } }
@keyframes ks-sum0 { 0%, 22% { opacity: 1; } 25%, 87% { opacity: 0; } 91%, 100% { opacity: 1; } }
@keyframes ks-sumA { 0%, 22% { opacity: 0; } 25%, 50% { opacity: 1; } 53%, 100% { opacity: 0; } }
@keyframes ks-sumB { 0%, 50% { opacity: 0; } 53%, 87% { opacity: 1; } 91%, 100% { opacity: 0; } }
`;
  return { html, style };
}

/** After the first sign-in code: a warm welcome, and how to get into the account from anywhere. */
export function welcomeMail(from: string | undefined, appUrl: string, logoUrl?: string, person?: string, now = new Date()): Mail {
  const name = senderName(from);
  const hi = greeting(person);
  const host = appUrl.replace(/^https?:\/\//, "").replace(/\/+$/, "");
  const demo = demoReceipt();
  const step = (n: number, text: string) =>
    `<tr><td style="width:26px;vertical-align:top;font-weight:700;color:${C.claim}">${n}.</td><td style="padding-bottom:6px">${text}</td></tr>`;
  const receipt = `${receiptHead("Willkommen", now)}
          <p style="margin:0 0 4px">${escapeHtml(hi)}</p>
          <p style="margin:0 0 12px">schön, dass Du dabei bist! Dein ${escapeHtml(name)}-Konto ist angelegt.</p>
          <p style="margin:0">Ab jetzt sind Deine Rechnungen, Dein Profil und Deine Bilanz sicher bei Dir – auf jedem Gerät, auch wenn Du mal das Handy wechselst.</p>
          ${rule}
          <p style="margin:0 0 6px;font-weight:700;letter-spacing:0.06em;text-transform:uppercase;font-size:13px">So einfach geht's</p>
          ${demo.html}
          ${rule}
          <p style="margin:0 0 10px;font-weight:700;letter-spacing:0.06em;text-transform:uppercase;font-size:13px">So kommst Du von überall rein</p>
          <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="font-family:${MONO};font-size:14px;line-height:1.55;color:${C.ink}">
            ${step(1, `<b>${escapeHtml(host)}</b> im Browser öffnen – am Handy, Tablet oder Laptop.`)}
            ${step(2, "„Anmelden“ tippen und Deine E-Mail-Adresse eingeben.")}
            ${step(3, "Den Code aus der Mail eintippen – fertig. Kein Passwort, nichts zu merken.")}
          </table>
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-top:14px"><tr>
            <td align="center" style="background:${C.mint};border-radius:14px">
              <a href="${escapeHtml(appUrl)}" style="display:block;padding:14px 12px;font-family:${DISPLAY};font-size:16px;font-weight:700;color:${C.brand};text-decoration:none">${escapeHtml(host)} öffnen</a>
            </td>
          </tr></table>
          ${rule}
          <p style="margin:0;font-size:13px;color:${C.inkSoft}">Tipp: Auf dem iPhone in Safari auf „Teilen“ und „Zum Home-Bildschirm“ tippen – dann ist ${escapeHtml(name)} wie eine App immer dabei, mit Benachrichtigungen, wenn Geld eingeht.</p>`;
  return {
    subject: `Willkommen bei ${name}!`,
    text: `${hi}\n\nschön, dass Du dabei bist! Dein ${name}-Konto ist angelegt. Ab jetzt sind Deine Rechnungen, Dein Profil und Deine Bilanz sicher bei Dir – auf jedem Gerät, auch wenn Du mal das Handy wechselst.\n\nSo kommst Du von überall rein:\n1. ${host} im Browser öffnen – am Handy, Tablet oder Laptop.\n2. „Anmelden“ tippen und Deine E-Mail-Adresse eingeben.\n3. Den Code aus der Mail eintippen – fertig. Kein Passwort, nichts zu merken.\n\n${appUrl}\n\nTipp: Auf dem iPhone in Safari auf „Teilen“ und „Zum Home-Bildschirm“ tippen – dann ist ${name} wie eine App immer dabei.\n\n\n\n${name} •\nEiner zahlt.\nAlle splitten.\n`,
    html: layout({ title: `Willkommen bei ${name}`, preheader: "Dein Konto ist angelegt – so kommst Du von überall rein.", name, logoUrl, receipt, style: demo.style }),
  };
}

/** Where the app is reachable (logo and links in the mails): PUBLIC_URL, else the Railway domain. */
export function publicUrl(): string | undefined {
  const url = process.env.PUBLIC_URL?.trim() || (process.env.RAILWAY_PUBLIC_DOMAIN ? `https://${process.env.RAILWAY_PUBLIC_DOMAIN}` : "");
  return url ? url.replace(/\/+$/, "") : undefined;
}

export interface Mailer {
  sendCode: SendCode;
  sendWelcome: SendWelcome;
}

export function mailerFromEnv(): Mailer {
  const apiKey = process.env.RESEND_API_KEY?.trim();
  const from = process.env.MAIL_FROM?.trim();
  if (!apiKey || !from) {
    const outbox = process.env.MAIL_OUTBOX;
    const note = async (entry: Record<string, string>) => {
      if (outbox) await appendFile(outbox, `${JSON.stringify(entry)}\n`);
    };
    return {
      sendCode: async (email, code) => {
        console.log(`[Mail] Kein Mail-Dienst eingerichtet (RESEND_API_KEY, MAIL_FROM) – Code für ${email}: ${code}`);
        await note({ email, code });
      },
      sendWelcome: async (email) => {
        console.log(`[Mail] Kein Mail-Dienst eingerichtet – Willkommensmail an ${email}`);
        await note({ email, welcome: "1" });
      },
    };
  }
  const base = publicUrl();
  const logo = base ? `${base}/icon-192.png` : undefined;
  const send = async (email: string, mail: Mail) => {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { authorization: `Bearer ${apiKey}`, "content-type": "application/json" },
      body: JSON.stringify({ from, to: [email], ...mail }),
    });
    if (!res.ok) throw new Error(`Resend ${res.status}: ${(await res.text()).slice(0, 300)}`);
  };
  return {
    sendCode: (email, code, name) => send(email, codeMail(code, from, logo, name)),
    sendWelcome: (email, name) => send(email, welcomeMail(from, base ?? "https://klicksplit.de", logo, name)),
  };
}
