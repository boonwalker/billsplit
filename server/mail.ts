/**
 * Sending the sign-in codes. With RESEND_API_KEY and MAIL_FROM (e.g. "klicksplit
 * <code@klicksplit.de>") the mail goes out through Resend; without them the code is only
 * written to the log, so everything can be tried before the mail service is set up (and, for
 * the click tests, to the file MAIL_OUTBOX).
 */

import { appendFile } from "node:fs/promises";

export type SendCode = (email: string, code: string) => Promise<void>;

/** The sender's display name ("klicksplit" in "klicksplit <code@klicksplit.de>"), used in the text too. */
export function senderName(from: string | undefined): string {
  const name = from?.match(/^\s*"?([^"<]+?)"?\s*</)?.[1]?.trim();
  return name || "klicksplit";
}

/** Colours and type of the app (src/styles/01-tokens.css), written out: mail clients know no CSS variables. */
const C = { bg: "#eef1ec", surface: "#ffffff", brand: "#0d3b2a", claim: "#0f7a4d", mint: "#3ddc97", mintSoft: "#d9f7e8", text: "#15201b", muted: "#5d6963", border: "#dfe5df" };
const DISPLAY = "'Space Grotesk', -apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif";
const BODY = "-apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif";
const MONO = "'JetBrains Mono', 'SF Mono', Menlo, Consolas, monospace";

const escapeHtml = (text: string) => text.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!);

/** "klicksplit" → klick + bold green split, like the app's wordmark. */
function wordmark(name: string): string {
  const m = name.match(/^(.*?)(split)$/i);
  const [first, second] = m && m[1] ? [m[1], m[2]] : [name, ""];
  return `<span style="font-family:${DISPLAY};font-size:24px;font-weight:500;letter-spacing:-0.02em;color:${C.text}">${escapeHtml(first)}<b style="font-weight:700;color:${C.claim}">${escapeHtml(second)}</b></span>`;
}

/**
 * The sign-in mail, in the app's look: logo and wordmark, the code large in a mint box. Built
 * the way mail clients need it (tables, inline styles, fallback fonts); logoUrl: the app icon
 * as an absolute address (left out when unknown).
 */
export function codeMail(code: string, from: string | undefined, logoUrl?: string): { subject: string; text: string; html: string } {
  const name = senderName(from);
  const logo = logoUrl
    ? `<td style="padding-right:10px;vertical-align:middle"><img src="${escapeHtml(logoUrl)}" width="40" height="40" alt="" style="display:block;border:0;border-radius:11px"></td>`
    : "";
  const html = `<!doctype html>
<html lang="de">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="color-scheme" content="light">
<meta name="supported-color-schemes" content="light">
<title>Dein ${escapeHtml(name)}-Code</title>
<link href="https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@500;700&amp;family=JetBrains+Mono:wght@700&amp;display=swap" rel="stylesheet">
</head>
<body style="margin:0;padding:0;background:${C.bg}">
<div style="display:none;max-height:0;overflow:hidden;opacity:0">Dein Code: ${code} – gilt 15 Minuten.</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:${C.bg}">
<tr><td align="center" style="padding:32px 16px">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:480px">
    <tr><td style="padding:0 4px 20px">
      <table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr>${logo}<td style="vertical-align:middle">${wordmark(name)}</td></tr></table>
    </td></tr>
    <tr><td style="background:${C.surface};border:1px solid ${C.border};border-radius:18px;padding:28px 24px">
      <p style="margin:0 0 6px;font-family:${BODY};font-size:16px;line-height:1.5;color:${C.text}">Hi,</p>
      <p style="margin:0 0 20px;font-family:${BODY};font-size:16px;line-height:1.5;color:${C.text}">hier ist Dein Code für ${escapeHtml(name)}:</p>
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr>
        <td align="center" style="background:${C.mintSoft};border-radius:14px;padding:18px 12px">
          <!-- One unbroken number (spaced by letter-spacing only): the iPhone offers codes from mails for filling in. -->
          <span style="font-family:${MONO};font-size:34px;font-weight:700;letter-spacing:10px;padding-left:10px;color:${C.brand}">${code}</span>
        </td>
      </tr></table>
      <p style="margin:20px 0 0;font-family:${BODY};font-size:15px;line-height:1.5;color:${C.text}">Tippe ihn in ${escapeHtml(name)} ein – dort, wo Du ihn angefordert hast. Er gilt <b>15 Minuten</b>.</p>
    </td></tr>
    <tr><td style="padding:18px 4px 0;font-family:${BODY};font-size:13px;line-height:1.5;color:${C.muted}">
      Wenn Du keinen Code angefordert hast, kannst Du diese Mail einfach ignorieren.<br>
      <span style="font-family:${DISPLAY};font-weight:700;color:${C.claim}">${escapeHtml(name)}</span> · Einer zahlt. Alle splitten.
    </td></tr>
  </table>
</td></tr>
</table>
</body>
</html>`;
  return {
    subject: `Dein ${name}-Code: ${code}`,
    text: `Hi,\n\nhier ist Dein Code für ${name}: ${code}\n\nTippe ihn in ${name} ein – dort, wo Du ihn angefordert hast. Er gilt 15 Minuten.\n\nWenn Du keinen Code angefordert hast, kannst Du diese Mail einfach ignorieren.\n\n${name} · Einer zahlt. Alle splitten.\n`,
    html,
  };
}

/** Where the app is reachable (for the logo in the mail): PUBLIC_URL, else the Railway domain. */
export function publicUrl(): string | undefined {
  const url = process.env.PUBLIC_URL?.trim() || (process.env.RAILWAY_PUBLIC_DOMAIN ? `https://${process.env.RAILWAY_PUBLIC_DOMAIN}` : "");
  return url ? url.replace(/\/+$/, "") : undefined;
}

export function mailerFromEnv(): SendCode {
  const apiKey = process.env.RESEND_API_KEY?.trim();
  const from = process.env.MAIL_FROM?.trim();
  if (!apiKey || !from) {
    const outbox = process.env.MAIL_OUTBOX;
    return async (email, code) => {
      console.log(`[Mail] Kein Mail-Dienst eingerichtet (RESEND_API_KEY, MAIL_FROM) – Code für ${email}: ${code}`);
      if (outbox) await appendFile(outbox, `${JSON.stringify({ email, code })}\n`);
    };
  }
  const base = publicUrl();
  const logo = base ? `${base}/icon-192.png` : undefined;
  return async (email, code) => {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { authorization: `Bearer ${apiKey}`, "content-type": "application/json" },
      body: JSON.stringify({ from, to: [email], ...codeMail(code, from, logo) }),
    });
    if (!res.ok) throw new Error(`Resend ${res.status}: ${(await res.text()).slice(0, 300)}`);
  };
}
